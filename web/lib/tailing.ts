import fs from "fs";
import path from "path";
import { findMainTranscript, findSessionTranscripts, sessionIdFor, subagentsDirFor } from "./session-path";

const POLL_INTERVAL_MS = 300;
/** A non-pinned session file is only picked up if it was touched this
 *  recently — long-idle history in ~/.claude/projects/<dir> shouldn't turn
 *  into a permanent tab. */
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;
/** Bounds resource usage (one TailedFile + poll per session per tick). */
const MAX_SESSIONS = 8;

export interface Envelope {
  source: "main" | "subagent" | "subagent-added" | "session-added" | "session-removed";
  sessionId: string;
  agentId: string | null;
  raw?: string;
  /** Only set on "session-added" — the session's transcript path, for display. */
  path?: string;
}

/**
 * Polls a file from a byte offset, yielding only complete newline-terminated
 * lines. Buffers a partial trailing line across polls so a line caught
 * mid-write is never emitted truncated. TypeScript port of tail_server.py's
 * TailedFile.
 */
class TailedFile {
  private offset = 0;
  private buffer = "";

  constructor(public readonly filePath: string) {}

  poll(): string[] {
    if (!fs.existsSync(this.filePath)) return [];
    const size = fs.statSync(this.filePath).size;
    if (size < this.offset) {
      // file was truncated or replaced — start over
      this.offset = 0;
      this.buffer = "";
    }
    if (size === this.offset) return [];

    const fd = fs.openSync(this.filePath, "r");
    try {
      const length = size - this.offset;
      const chunkBuf = Buffer.alloc(length);
      fs.readSync(fd, chunkBuf, 0, length, this.offset);
      this.offset = size;
      this.buffer += chunkBuf.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }

    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? ""; // last element is partial (or empty)
    return lines.filter((l) => l.trim().length > 0);
  }
}

/**
 * Pub-sub with backlog replay: a new subscriber gets every envelope seen so
 * far, then live updates — so a client just needs to connect, no separate
 * initial-file-load step.
 */
class Broadcaster {
  private subscribers = new Set<(envelope: Envelope) => void>();
  public backlog: Envelope[] = [];

  subscribe(onEnvelope: (envelope: Envelope) => void): () => void {
    for (const envelope of this.backlog) onEnvelope(envelope);
    this.subscribers.add(onEnvelope);
    return () => this.subscribers.delete(onEnvelope);
  }

  publish(envelope: Envelope) {
    this.backlog.push(envelope);
    for (const fn of this.subscribers) fn(envelope);
  }
}

interface SessionState {
  path: string;
  tail: TailedFile;
  subagentsDir: string;
  subagentTails: Map<string, TailedFile>;
}

interface TailingState {
  broadcaster: Broadcaster;
  mainPath: string;
  mainId: string;
  sessions: Map<string, SessionState>;
  intervalHandle: ReturnType<typeof setInterval> | null;
}

// Next.js dev mode re-executes modules on HMR; stash the singleton on
// globalThis so a reload doesn't spawn a second poller or reset the backlog.
const globalForTailing = globalThis as unknown as { __tailingState?: TailingState };

function makeSession(filePath: string): SessionState {
  return {
    path: filePath,
    tail: new TailedFile(filePath),
    subagentsDir: subagentsDirFor(filePath),
    subagentTails: new Map(),
  };
}

export function getTailingState(): TailingState {
  if (!globalForTailing.__tailingState) {
    const mainPath = findMainTranscript(process.env.TRANSCRIPT_PATH);
    const mainId = sessionIdFor(mainPath);
    const broadcaster = new Broadcaster();
    const sessions = new Map<string, SessionState>();
    sessions.set(mainId, makeSession(mainPath));
    broadcaster.publish({ source: "session-added", sessionId: mainId, agentId: null, path: mainPath });

    globalForTailing.__tailingState = { broadcaster, mainPath, mainId, sessions, intervalHandle: null };
  }
  return globalForTailing.__tailingState;
}

/** Scans the project directory for other recently-active session files and
 *  starts tailing them too, up to MAX_SESSIONS. No-op in single-session
 *  (TRANSCRIPT_PATH-override) mode. */
function discoverSessions(state: TailingState): void {
  if (process.env.TRANSCRIPT_PATH) return;

  let candidates: string[];
  try {
    candidates = findSessionTranscripts();
  } catch {
    return;
  }

  const now = Date.now();
  for (const filePath of candidates) {
    if (state.sessions.size >= MAX_SESSIONS) break;
    const id = sessionIdFor(filePath);
    if (state.sessions.has(id)) continue;

    const mtimeMs = fs.statSync(filePath).mtimeMs;
    if (now - mtimeMs > ACTIVE_WINDOW_MS) continue; // stale history, not a live tab

    state.sessions.set(id, makeSession(filePath));
    state.broadcaster.publish({ source: "session-added", sessionId: id, agentId: null, path: filePath });
  }
}

export function startPolling(): void {
  const state = getTailingState();
  if (state.intervalHandle) return; // already running

  const tick = () => {
    discoverSessions(state);

    // Snapshot entries before mutating — a session whose backing file has
    // been deleted (rotated out, or a saved-replay file moved) shouldn't
    // linger as a dead tab forever.
    for (const [sessionId, session] of Array.from(state.sessions)) {
      if (!fs.existsSync(session.path)) {
        state.sessions.delete(sessionId);
        state.broadcaster.publish({ source: "session-removed", sessionId, agentId: null });
        continue;
      }

      for (const line of session.tail.poll()) {
        state.broadcaster.publish({ source: "main", sessionId, agentId: null, raw: line });
      }

      if (fs.existsSync(session.subagentsDir) && fs.statSync(session.subagentsDir).isDirectory()) {
        const files = fs
          .readdirSync(session.subagentsDir)
          .filter((f) => f.startsWith("agent-") && f.endsWith(".jsonl"))
          .sort();
        for (const fileName of files) {
          if (!session.subagentTails.has(fileName)) {
            const fullPath = path.join(session.subagentsDir, fileName);
            session.subagentTails.set(fileName, new TailedFile(fullPath));
            const agentId = fileName.slice("agent-".length, -".jsonl".length);
            state.broadcaster.publish({ source: "subagent-added", sessionId, agentId });
          }
        }
      }

      for (const [fileName, tf] of session.subagentTails) {
        const agentId = fileName.slice("agent-".length, -".jsonl".length);
        for (const line of tf.poll()) {
          state.broadcaster.publish({ source: "subagent", sessionId, agentId, raw: line });
        }
      }
    }
  };

  tick(); // pick up anything already on disk before the first interval fires
  state.intervalHandle = setInterval(tick, POLL_INTERVAL_MS);
}
