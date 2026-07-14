/**
 * Parses Claude Code's native JSONL session transcript format and builds a
 * turn tree + tool-call index for rendering.
 */

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: unknown; is_error?: boolean | null }
  | Record<string, unknown>;

export interface TranscriptRecord {
  type: string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  sessionId?: string;
  agentId?: string;
  isSidechain?: boolean;
  message?: {
    role?: string;
    content?: string | ContentBlock[];
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  toolUseResult?: Record<string, unknown> & {
    agentId?: string;
    status?: string;
    totalDurationMs?: number;
    totalTokens?: number;
    totalToolUseCount?: number;
    toolStats?: Record<string, number>;
    stdout?: string;
    stderr?: string;
  };
  content?: unknown;
  __children?: TranscriptRecord[];
  [key: string]: unknown;
}

export interface ToolCallEntry {
  id: string;
  name: string;
  input: Record<string, unknown>;
  callTimestamp: string;
  callUuid?: string;
  result: {
    content: unknown;
    isError: boolean;
    resultTimestamp: string;
    toolUseResult: TranscriptRecord["toolUseResult"] | null;
  } | null;
  durationMs: number | null;
  isAgent: boolean;
  agentId: string | null;
  agentStatus: string | null;
  agentSummary: {
    totalDurationMs?: number;
    totalTokens?: number;
    totalToolUseCount?: number;
    toolStats?: Record<string, number>;
  } | null;
}

export interface ProcessedTranscript {
  records: TranscriptRecord[];
  parseErrorCount: number;
  attachmentCount: number;
  toolCalls: Map<string, ToolCallEntry>;
  roots: TranscriptRecord[];
  meta: {
    sessionId: string | null;
    agentIdOfFile: string | null;
    isSidechainFile: boolean;
    lineCount: number;
    /**
     * Context size of the most recent assistant turn (input + cache read +
     * cache creation + output) — the "38k / 200k tokens" number. Null until
     * the first assistant record with usage arrives.
     */
    contextTokens: number | null;
    /** Sum of output_tokens across all assistant turns — work produced. */
    totalOutputTokens: number;
  };
}

export function parseJSONL(text: string): { records: TranscriptRecord[]; parseErrorCount: number } {
  const lines = text.split("\n");
  const records: TranscriptRecord[] = [];
  let parseErrorCount = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      parseErrorCount++;
    }
  }
  return { records, parseErrorCount };
}

export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (typeof b === "string") return b;
        if (b && typeof b === "object" && "type" in b && b.type === "text" && "text" in b) {
          return String((b as { text: unknown }).text);
        }
        return "";
      })
      .join("\n");
  }
  return "";
}

export function buildToolCallIndex(records: TranscriptRecord[]): Map<string, ToolCallEntry> {
  const toolCalls = new Map<string, ToolCallEntry>();

  for (const r of records) {
    if (r.type === "assistant" && r.message && Array.isArray(r.message.content)) {
      for (const block of r.message.content) {
        if (block && typeof block === "object" && "type" in block && block.type === "tool_use") {
          const tu = block as { id: string; name: string; input: Record<string, unknown> };
          toolCalls.set(tu.id, {
            id: tu.id,
            name: tu.name,
            input: tu.input,
            callTimestamp: r.timestamp ?? "",
            callUuid: r.uuid,
            result: null,
            durationMs: null,
            isAgent: tu.name === "Agent",
            agentId: null,
            agentStatus: null,
            agentSummary: null,
          });
        }
      }
    }
  }

  for (const ru of records) {
    if (ru.type === "user" && ru.message && Array.isArray(ru.message.content)) {
      for (const block of ru.message.content) {
        if (block && typeof block === "object" && "type" in block && block.type === "tool_result") {
          const tr = block as { tool_use_id: string; content: unknown; is_error?: boolean | null };
          const entry = toolCalls.get(tr.tool_use_id);
          if (!entry) continue; // orphaned result — parent call not in this file
          entry.result = {
            content: tr.content,
            isError: tr.is_error === true, // is_error can be null/absent on success
            resultTimestamp: ru.timestamp ?? "",
            toolUseResult: ru.toolUseResult ?? null,
          };
          entry.durationMs =
            entry.callTimestamp && ru.timestamp
              ? new Date(ru.timestamp).getTime() - new Date(entry.callTimestamp).getTime()
              : null;
          if (entry.isAgent && ru.toolUseResult) {
            entry.agentId = ru.toolUseResult.agentId ?? null;
            entry.agentStatus = ru.toolUseResult.status ?? null;
            if (entry.agentStatus === "completed") {
              entry.agentSummary = {
                totalDurationMs: ru.toolUseResult.totalDurationMs,
                totalTokens: ru.toolUseResult.totalTokens,
                totalToolUseCount: ru.toolUseResult.totalToolUseCount,
                toolStats: ru.toolUseResult.toolStats,
              };
            }
          }
        }
      }
    }
  }

  return toolCalls;
}

// Builds a forest from parentUuid/uuid. Orphans (parent not present in this
// file, or a truncated transcript) become synthetic roots. Attachment lines
// are included so the parent/child chain stays intact — whether to *render*
// them is a display-layer decision, not a tree-topology one.
export function buildForest(records: TranscriptRecord[]): TranscriptRecord[] {
  const convo = records.filter((r) => r.type === "user" || r.type === "assistant" || r.type === "attachment");
  const byUuid = new Map<string, TranscriptRecord>();
  for (const r of convo) {
    if (r.uuid) {
      r.__children = [];
      byUuid.set(r.uuid, r);
    }
  }
  const roots: TranscriptRecord[] = [];
  for (const r of convo) {
    if (!r.uuid) continue;
    if (r.parentUuid && byUuid.has(r.parentUuid)) {
      byUuid.get(r.parentUuid)!.__children!.push(r);
    } else {
      roots.push(r);
    }
  }
  function sortRec(list: TranscriptRecord[]) {
    list.sort((a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime());
    for (const n of list) sortRec(n.__children ?? []);
  }
  sortRec(roots);
  return roots;
}

// Claude Code transcripts are overwhelmingly one long linear parent -> child
// chain (a turn nearly always has exactly one child: the next turn). The
// tree from buildForest() models that correctly, but rendering it by having
// each turn's React component recurse into its own child's component is
// disastrous at scale: a 300+ turn session means 300+ levels of *component*
// recursion, and each level costs far more stack than a plain function call
// once AnimatePresence/motion wrap it — verified to blow the call stack on
// this repo's own (long-running) session transcript. Turns were never
// visually indented for chaining anyway (only tool calls and subagent
// nesting are), so flattening the chain into one iterative list changes
// nothing about the rendered output and fixes the recursion depth problem
// at its source. Tool-call/subagent nesting stays recursive — it's shallow
// (a handful of levels) and genuinely needs the indentation.
export function flattenTurns(roots: TranscriptRecord[]): TranscriptRecord[] {
  const flat: TranscriptRecord[] = [];
  const stack: TranscriptRecord[] = [...roots].reverse();
  while (stack.length > 0) {
    const node = stack.pop()!;
    flat.push(node);
    const kids = node.__children ?? [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  return flat;
}

export function isToolResultMessage(r: TranscriptRecord): boolean {
  return (
    r.type === "user" &&
    !!r.message &&
    Array.isArray(r.message.content) &&
    r.message.content.length > 0 &&
    (r.message.content[0] as ContentBlock).type === "tool_result"
  );
}

export function processTranscript(text: string): ProcessedTranscript {
  const parsed = parseJSONL(text);
  const { records } = parsed;
  const attachmentCount = records.filter((r) => r.type === "attachment").length;
  const toolCalls = buildToolCallIndex(records);
  const roots = buildForest(records);

  let sessionId: string | null = null;
  let agentIdOfFile: string | null = null;
  let isSidechainFile = false;
  let contextTokens: number | null = null;
  let totalOutputTokens = 0;
  for (const r of records) {
    if (r.sessionId && !sessionId) sessionId = r.sessionId;
    if (r.agentId && !agentIdOfFile) agentIdOfFile = r.agentId;
    if (r.isSidechain) isSidechainFile = true;
    if (r.type === "assistant" && r.message?.usage) {
      const u = r.message.usage;
      totalOutputTokens += u.output_tokens ?? 0;
      contextTokens =
        (u.input_tokens ?? 0) +
        (u.cache_read_input_tokens ?? 0) +
        (u.cache_creation_input_tokens ?? 0) +
        (u.output_tokens ?? 0);
    }
  }

  return {
    records,
    parseErrorCount: parsed.parseErrorCount,
    attachmentCount,
    toolCalls,
    roots,
    meta: {
      sessionId,
      agentIdOfFile,
      isSidechainFile,
      lineCount: records.length,
      contextTokens,
      totalOutputTokens,
    },
  };
}
