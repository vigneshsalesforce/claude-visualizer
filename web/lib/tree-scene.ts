/**
 * Builds a deduplicated capability tree from a transcript, for the "Tree"
 * view — a static architecture-diagram-style map of which tools/subagents
 * an agent uses, closer in spirit to an asset catalog (MuleSoft's Agent
 * Visualizer) than to a chronological call log. Unlike `graph-layout.ts`
 * (one node per turn/call, left-to-right chronological) and
 * `canvas-scene.ts` (one physics body per agent, live), this collapses
 * repeated calls to the same tool — or repeated dispatches of the same
 * subagent_type — into a single node with a call count.
 */
import type { ProcessedTranscript, ToolCallEntry } from "./transcript-parser";
import type { GraphStatus } from "./graph-layout";

export type NodeBadge = "Agent" | "Tool" | "MCP" | "Skill";

export interface TreeNode {
  id: string;
  name: string;
  badge: NodeBadge;
  platform: string;
  description: string;
  callCount: number;
  status: GraphStatus;
  toolCalls: ToolCallEntry[];
  dispatchToolCall?: ToolCallEntry | null;
  children: TreeNode[];
}

const NATIVE_TOOL_DESCRIPTIONS: Record<string, string> = {
  Bash: "Executes shell commands.",
  Read: "Reads a file's contents.",
  Edit: "Makes an exact string replacement in a file.",
  Write: "Writes a file to disk.",
  Grep: "Searches file contents with ripgrep.",
  Glob: "Finds files by name pattern.",
  WebFetch: "Fetches and summarizes a URL.",
  WebSearch: "Searches the web.",
  TodoWrite: "Tracks a structured task list.",
  TodoRead: "Reads the current structured task list.",
  NotebookEdit: "Edits a Jupyter notebook cell.",
};

function toolMeta(name: string, isAgent: boolean, isSkill: boolean): { badge: NodeBadge; platform: string; description: string } {
  if (isAgent) return { badge: "Agent", platform: "Claude Code", description: "A Claude Code subagent." };
  if (isSkill) return { badge: "Skill", platform: "Claude Code", description: `Invokes the "${name}" skill.` };
  if (name.startsWith("mcp__")) {
    const server = name.split("__")[1] ?? "mcp";
    return { badge: "MCP", platform: server, description: `MCP tool provided by the ${server} server.` };
  }
  return { badge: "Tool", platform: "Claude Code", description: NATIVE_TOOL_DESCRIPTIONS[name] ?? "A built-in Claude Code tool." };
}

function aggregateStatus(calls: ToolCallEntry[]): GraphStatus {
  let pending = false;
  for (const tc of calls) {
    if (!tc.result) pending = true;
    else if (tc.result.isError) return "error";
  }
  return pending ? "pending" : "ok";
}

function buildChildren(toolCalls: ToolCallEntry[], subagentProcessed: Map<string, ProcessedTranscript>): TreeNode[] {
  interface Group {
    isAgent: boolean;
    isSkill: boolean;
    label: string;
    calls: ToolCallEntry[];
  }
  const groups = new Map<string, Group>();

  for (const tc of toolCalls) {
    const isAgent = tc.isAgent;
    // A Skill invocation is a "Skill" tool_use with input.skill naming which
    // skill was run — group by the invoked skill's name, not by the literal
    // tool name "Skill", so distinct skills show as distinct nodes.
    const isSkill = !isAgent && tc.name === "Skill";
    const label = isAgent
      ? String(tc.input.subagent_type ?? "general")
      : isSkill
        ? String(tc.input.skill ?? "unknown")
        : tc.name;
    const key = isAgent ? `agent:${label}` : isSkill ? `skill:${label}` : `tool:${label}`;
    const existing = groups.get(key);
    if (existing) existing.calls.push(tc);
    else groups.set(key, { isAgent, isSkill, label, calls: [tc] });
  }

  const children: TreeNode[] = [];
  for (const [key, group] of groups) {
    const meta = toolMeta(group.label, group.isAgent, group.isSkill);
    const status = aggregateStatus(group.calls);

    if (group.isAgent) {
      const mergedGrandchildCalls: ToolCallEntry[] = [];
      for (const tc of group.calls) {
        if (tc.agentId) {
          const child = subagentProcessed.get(tc.agentId);
          if (child) mergedGrandchildCalls.push(...Array.from(child.toolCalls.values()));
        }
      }
      const latest = group.calls[group.calls.length - 1];
      children.push({
        id: `node-${key}`,
        name: group.label,
        badge: meta.badge,
        platform: meta.platform,
        description: (latest?.input.description as string | undefined) || meta.description,
        callCount: group.calls.length,
        status,
        toolCalls: group.calls,
        dispatchToolCall: latest ?? null,
        children: buildChildren(mergedGrandchildCalls, subagentProcessed),
      });
    } else {
      children.push({
        id: `node-${key}`,
        name: group.label,
        badge: meta.badge,
        platform: meta.platform,
        description: meta.description,
        callCount: group.calls.length,
        status,
        toolCalls: group.calls,
        children: [],
      });
    }
  }
  return children;
}

export function buildTree(
  processed: ProcessedTranscript | null,
  subagentProcessed: Map<string, ProcessedTranscript>
): TreeNode | null {
  if (!processed) return null;
  const toolCalls = Array.from(processed.toolCalls.values());
  return {
    id: "root",
    name: "Claude Code Session",
    badge: "Agent",
    platform: "Claude Code",
    description: "The main Claude Code session that coordinates every tool call and subagent dispatch below.",
    callCount: toolCalls.length,
    status: aggregateStatus(toolCalls),
    toolCalls,
    dispatchToolCall: null,
    children: buildChildren(toolCalls, subagentProcessed),
  };
}

export function flattenTree(root: TreeNode | null): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>();
  if (!root) return map;
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    map.set(node.id, node);
    stack.push(...node.children);
  }
  return map;
}
