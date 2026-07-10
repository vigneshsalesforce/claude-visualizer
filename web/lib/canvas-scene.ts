/**
 * Pure transform from the parsed transcript data (shared with the Timeline
 * and xyflow Graph views) into a physics-friendly scene graph for the
 * Canvas2D + d3-force view. Mirrors the recursive walk in `graph-layout.ts`,
 * but emits agents/tool-calls/messages/edges instead of xyflow nodes/edges —
 * see that file for the shared turn-walking shape this is modeled on.
 */
import {
  flattenTurns,
  isToolResultMessage,
  type ProcessedTranscript,
  type ToolCallEntry,
  type TranscriptRecord,
} from "./transcript-parser";
import type { GraphStatus } from "./graph-layout";

export type SceneAgentStatus = "running" | "done" | "error";

export interface SceneAgent {
  kind: "agent";
  id: string;
  parentId: string | null;
  label: string;
  status: SceneAgentStatus;
  depth: number;
  /** The Agent tool call that dispatched this agent (null for the root session). */
  dispatchToolCall: ToolCallEntry | null;
  /** Context tokens used (latest assistant turn), null when unknown. */
  tokensUsed: number | null;
  /** Context window size the token bar is drawn against. */
  tokensMax: number;
}

export interface SceneToolCall {
  kind: "tool";
  id: string;
  ownerAgentId: string;
  name: string;
  status: GraphStatus;
  timestamp?: string;
  duration: string;
  raw: ToolCallEntry;
}

export interface SceneMessage {
  kind: "message";
  id: string;
  ownerAgentId: string;
  role: "user" | "assistant";
  text: string;
  timestamp?: string;
  raw: TranscriptRecord;
}

export interface SceneEdge {
  source: string;
  target: string;
}

export interface SceneGraph {
  agents: SceneAgent[];
  toolCalls: SceneToolCall[];
  messages: SceneMessage[];
  edges: SceneEdge[];
}

const ROOT_AGENT_ID = "root";
const CONTEXT_WINDOW_TOKENS = 200_000;

function statusOf(tc: ToolCallEntry): GraphStatus {
  return !tc.result ? "pending" : tc.result.isError ? "error" : "ok";
}

function statusToAgentStatus(status: GraphStatus): SceneAgentStatus {
  if (status === "pending") return "running";
  if (status === "error") return "error";
  return "done";
}

function messageText(turn: TranscriptRecord): string {
  const content = turn.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const text = content.find((b) => b && typeof b === "object" && "type" in b && b.type === "text") as
      | { text?: string }
      | undefined;
    if (text?.text) return text.text;
    const thinking = content.find((b) => b && typeof b === "object" && "type" in b && b.type === "thinking") as
      | { thinking?: string }
      | undefined;
    if (thinking?.thinking) return "(thinking) " + thinking.thinking;
  }
  return "";
}

interface SceneContext {
  agents: SceneAgent[];
  toolCalls: SceneToolCall[];
  messages: SceneMessage[];
  edges: SceneEdge[];
  subagentProcessed: Map<string, ProcessedTranscript>;
}

function walkChain(
  ctx: SceneContext,
  turns: TranscriptRecord[],
  toolCallIndex: ProcessedTranscript["toolCalls"],
  ownerAgentId: string,
  depth: number
): void {
  for (const turn of turns) {
    if (turn.type === "attachment") continue;
    if (turn.type === "user" && isToolResultMessage(turn)) continue;
    if (turn.type !== "user" && turn.type !== "assistant") continue;

    const text = messageText(turn);
    if (text || turn.type === "user") {
      ctx.messages.push({
        kind: "message",
        id: `msg-${turn.uuid}`,
        ownerAgentId,
        role: turn.type,
        text,
        timestamp: turn.timestamp,
        raw: turn,
      });
    }

    if (turn.type !== "assistant" || !Array.isArray(turn.message?.content)) continue;

    for (const block of turn.message!.content as Array<{ type?: string; id?: string }>) {
      if (!block || block.type !== "tool_use" || !block.id) continue;
      const tc = toolCallIndex.get(block.id);
      if (!tc) continue;

      const status = statusOf(tc);

      if (tc.isAgent && tc.agentId) {
        const childId = tc.agentId;
        const childProcessed = ctx.subagentProcessed.get(childId);
        ctx.agents.push({
          kind: "agent",
          id: childId,
          parentId: ownerAgentId,
          label: String(tc.input.subagent_type ?? "general"),
          status: statusToAgentStatus(status),
          depth: depth + 1,
          dispatchToolCall: tc,
          tokensUsed: childProcessed?.meta.contextTokens ?? tc.agentSummary?.totalTokens ?? null,
          tokensMax: CONTEXT_WINDOW_TOKENS,
        });
        ctx.edges.push({ source: ownerAgentId, target: childId });

        const child = childProcessed;
        if (child) {
          walkChain(ctx, flattenTurns(child.roots), child.toolCalls, childId, depth + 1);
        }
        continue;
      }

      ctx.toolCalls.push({
        kind: "tool",
        id: `tool-${tc.id}`,
        ownerAgentId,
        name: tc.name,
        status,
        timestamp: tc.callTimestamp,
        duration: tc.durationMs == null ? "" : tc.durationMs < 1000 ? `${tc.durationMs}ms` : `${(tc.durationMs / 1000).toFixed(1)}s`,
        raw: tc,
      });
    }
  }
}

function rootStatus(toolCalls: SceneToolCall[]): SceneAgentStatus {
  let hasPending = false;
  for (const tc of toolCalls) {
    if (tc.ownerAgentId !== ROOT_AGENT_ID) continue;
    if (tc.status === "error") return "error";
    if (tc.status === "pending") hasPending = true;
  }
  return hasPending ? "running" : "done";
}

export function buildScene(
  processed: ProcessedTranscript | null,
  subagentProcessed: Map<string, ProcessedTranscript>
): SceneGraph {
  if (!processed) return { agents: [], toolCalls: [], messages: [], edges: [] };

  const ctx: SceneContext = { agents: [], toolCalls: [], messages: [], edges: [], subagentProcessed };
  const rootAgent: SceneAgent = {
    kind: "agent",
    id: ROOT_AGENT_ID,
    parentId: null,
    label: "session",
    status: "done",
    depth: 0,
    dispatchToolCall: null,
    tokensUsed: processed.meta.contextTokens,
    tokensMax: CONTEXT_WINDOW_TOKENS,
  };
  ctx.agents.push(rootAgent);

  walkChain(ctx, flattenTurns(processed.roots), processed.toolCalls, ROOT_AGENT_ID, 0);
  rootAgent.status = rootStatus(ctx.toolCalls);

  return { agents: ctx.agents, toolCalls: ctx.toolCalls, messages: ctx.messages, edges: ctx.edges };
}
