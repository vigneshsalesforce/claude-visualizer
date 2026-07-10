import type { Edge, Node } from "@xyflow/react";
import {
  flattenTurns,
  isToolResultMessage,
  type ProcessedTranscript,
  type ToolCallEntry,
  type TranscriptRecord,
} from "./transcript-parser";

export type GraphNodeKind = "turn" | "tool" | "agent";
export type GraphStatus = "ok" | "error" | "pending" | "none";

export interface TurnNodeData {
  kind: "turn";
  role: "user" | "assistant";
  label: string;
  timestamp?: string;
  raw: TranscriptRecord;
  [key: string]: unknown;
}

export interface ToolNodeData {
  kind: "tool" | "agent";
  name: string;
  label: string;
  status: GraphStatus;
  duration: string;
  timestamp?: string;
  raw: ToolCallEntry;
  [key: string]: unknown;
}

export type GraphNode = Node<TurnNodeData> | Node<ToolNodeData>;

const X_STEP = 230;
const SUBAGENT_Y_OFFSET = 170;

const EDGE_STROKE: Record<GraphStatus, string> = {
  ok: "color-mix(in srgb, var(--success) 45%, var(--border))",
  error: "var(--error)",
  pending: "var(--accent)",
  none: "var(--border)",
};

function edge(source: string, target: string, targetStatus: GraphStatus = "none"): Edge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    animated: targetStatus === "pending",
    type: "smoothstep",
    style: { stroke: EDGE_STROKE[targetStatus], strokeWidth: targetStatus === "none" ? 1.5 : 2 },
  };
}

function turnLabel(turn: TranscriptRecord): string {
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

interface LayoutContext {
  nodes: GraphNode[];
  edges: Edge[];
  subagentProcessed: Map<string, ProcessedTranscript>;
}

/**
 * Lays out one chain (a flattened turn list) left-to-right starting at
 * (xStart, y). Subagent dispatches branch downward into their own
 * left-to-right chain, connected back to the dispatching node. Returns the
 * next free x position after this chain, so a caller laying out multiple
 * independent chains can avoid overlap (not currently needed — one main
 * chain per processed transcript — but keeps this reusable).
 */
function layoutChain(
  ctx: LayoutContext,
  turns: TranscriptRecord[],
  toolCallIndex: ProcessedTranscript["toolCalls"],
  xStart: number,
  y: number,
  branchFromId?: string
): number {
  let x = xStart;
  let prevId: string | undefined = branchFromId;
  let isFirst = true;

  for (const turn of turns) {
    if (turn.type === "attachment") continue;
    if (turn.type === "user" && isToolResultMessage(turn)) continue;

    if (turn.type === "user" || turn.type === "assistant") {
      const label = turnLabel(turn);
      if (label || turn.type === "user") {
        const turnId = `turn-${turn.uuid}`;
        ctx.nodes.push({
          id: turnId,
          type: "turn",
          position: { x, y },
          data: { kind: "turn", role: turn.type, label, timestamp: turn.timestamp, raw: turn },
        });
        if (prevId) ctx.edges.push(edge(prevId, turnId));
        prevId = turnId;
        x += X_STEP;
        isFirst = false;
      }

      if (turn.type === "assistant" && Array.isArray(turn.message?.content)) {
        for (const block of turn.message!.content as Array<{ type?: string; id?: string }>) {
          if (!block || block.type !== "tool_use" || !block.id) continue;
          const tc = toolCallIndex.get(block.id);
          if (!tc) continue;

          const status: GraphStatus = !tc.result ? "pending" : tc.result.isError ? "error" : "ok";
          const toolId = `tool-${tc.id}`;
          ctx.nodes.push({
            id: toolId,
            type: tc.isAgent ? "agent" : "tool",
            position: { x, y },
            data: {
              kind: tc.isAgent ? "agent" : "tool",
              name: tc.name,
              label: tc.isAgent ? String(tc.input.subagent_type ?? "general") : tc.name,
              status,
              duration:
                tc.durationMs == null ? "" : tc.durationMs < 1000 ? `${tc.durationMs}ms` : `${(tc.durationMs / 1000).toFixed(1)}s`,
              timestamp: tc.callTimestamp,
              raw: tc,
            },
          });
          if (prevId) ctx.edges.push(edge(prevId, toolId, status));
          prevId = toolId;
          x += X_STEP;
          isFirst = false;

          if (tc.isAgent && tc.agentId) {
            const child = ctx.subagentProcessed.get(tc.agentId);
            if (child) {
              layoutChain(ctx, flattenTurns(child.roots), child.toolCalls, x, y + SUBAGENT_Y_OFFSET, toolId);
            }
          }
        }
      }
    }
  }

  void isFirst;
  return x;
}

export function buildGraph(
  processed: ProcessedTranscript,
  subagentProcessed: Map<string, ProcessedTranscript>
): { nodes: GraphNode[]; edges: Edge[] } {
  const ctx: LayoutContext = { nodes: [], edges: [], subagentProcessed };
  const turns = flattenTurns(processed.roots);
  layoutChain(ctx, turns, processed.toolCalls, 0, 0);
  return { nodes: ctx.nodes, edges: ctx.edges };
}
