import type { ToolCallEntry } from "./transcript-parser";

export function fmtTime(ts?: string): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function truncate(s: unknown, n: number): string {
  const str = String(s ?? "");
  return str.length > n ? str.slice(0, n) + "…" : str;
}

export function keyParamSummary(toolCall: ToolCallEntry): string {
  const input = toolCall.input || {};
  switch (toolCall.name) {
    case "Bash":
      return truncate(input.command, 90);
    case "Read":
      return `${input.file_path}${input.offset ? " @" + input.offset : ""}`;
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return String(input.file_path ?? "");
    case "Grep":
      return `${input.pattern}${input.path ? " in " + input.path : ""}`;
    case "Glob":
      return String(input.pattern ?? "");
    case "Agent":
      return `${input.subagent_type || "general"} — ${truncate(input.description, 60)}`;
    default:
      return truncate(JSON.stringify(input), 90);
  }
}
