"use client";

/**
 * Token summary panel, styled after Agent Flow's top-right cost overlay —
 * but denominated in tokens: transcripts carry no pricing, so dollar
 * figures aren't honestly computable.
 */
import type { SceneAgent } from "@/lib/canvas-scene";
import type { ProcessedTranscript } from "@/lib/transcript-parser";
import { HOLO } from "@/lib/holo";
import { formatTokens } from "./draw-agents";

function toolTypeColor(name: string): string {
  const n = name.toLowerCase();
  if (n === "read" || n === "glob" || n === "grep") return HOLO.holoBase;
  if (n === "edit" || n === "write" || n === "notebookedit") return HOLO.dispatch;
  if (n === "bash" || n === "powershell") return HOLO.tool;
  return HOLO.return;
}

export function CostPanel({
  agents,
  processed,
  onClose,
}: {
  agents: SceneAgent[];
  processed: ProcessedTranscript | null;
  onClose: () => void;
}) {
  const rows = agents
    .filter((a) => a.tokensUsed != null && a.tokensUsed > 0)
    .sort((a, b) => (b.tokensUsed ?? 0) - (a.tokensUsed ?? 0))
    .slice(0, 5);
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokensUsed ?? 0), 0);
  const maxTokens = rows[0]?.tokensUsed ?? 1;

  // Tool usage: root tool calls counted from the transcript, subagent tools
  // from their completion summaries.
  const toolCounts = new Map<string, number>();
  if (processed) {
    for (const tc of processed.toolCalls.values()) {
      toolCounts.set(tc.name, (toolCounts.get(tc.name) ?? 0) + 1);
    }
  }
  for (const agent of agents) {
    const stats = agent.dispatchToolCall?.agentSummary?.toolStats;
    if (!stats) continue;
    for (const [name, count] of Object.entries(stats)) {
      toolCounts.set(name, (toolCounts.get(name) ?? 0) + count);
    }
  }
  const toolRows = Array.from(toolCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxToolCount = toolRows[0]?.[1] ?? 1;

  return (
    <div
      className="absolute top-3 right-3 z-20 w-[200px] rounded-lg px-3 py-3 font-mono backdrop-blur-md"
      style={{ background: HOLO.panelBg, border: `1px solid ${HOLO.glassBorder}` }}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] font-bold" style={{ color: HOLO.costText }}>
          {formatTokens(totalTokens)}
        </span>
        <span className="text-[9px]" style={{ color: HOLO.textMuted }}>
          tokens
        </span>
        <button
          type="button"
          onClick={onClose}
          className="focus-ring rounded px-1 text-xs"
          style={{ color: HOLO.textMuted }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {rows.map((agent) => (
        <div key={agent.id} className="mb-1.5">
          <div className="flex items-center justify-between gap-1.5 text-[8px]">
            <span className="min-w-0 truncate" style={{ color: HOLO.textPrimary }} title={agent.label}>
              {agent.label}
            </span>
            <span className="flex-none" style={{ color: HOLO.costText }}>
              {formatTokens(agent.tokensUsed ?? 0)}
            </span>
          </div>
          <div className="mt-0.5 h-[3px] rounded-full" style={{ background: HOLO.holoBorder06 }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${((agent.tokensUsed ?? 0) / maxTokens) * 100}%`,
                background: agent.depth === 0 ? "rgba(102, 204, 255, 0.35)" : "rgba(204, 136, 255, 0.35)",
              }}
            />
          </div>
        </div>
      ))}

      {toolRows.length > 0 && (
        <>
          <div className="mt-3 mb-1.5 text-[8px] tracking-wider" style={{ color: HOLO.textMuted }}>
            BY TOOL
          </div>
          {toolRows.map(([name, count]) => (
            <div key={name} className="mb-1.5">
              <div className="flex items-center justify-between gap-1.5 text-[8px]">
                <span className="min-w-0 truncate" style={{ color: HOLO.textPrimary }} title={name}>
                  {name}
                </span>
                <span className="flex-none" style={{ color: HOLO.textMuted }}>
                  {count}
                </span>
              </div>
              <div className="mt-0.5 h-[3px] rounded-full" style={{ background: HOLO.holoBorder06 }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(count / maxToolCount) * 100}%`, background: `${toolTypeColor(name)}33` }}
                />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
