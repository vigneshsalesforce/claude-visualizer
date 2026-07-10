"use client";

import { AnimatePresence, motion } from "motion/react";
import { extractText } from "@/lib/transcript-parser";
import { fmtDuration, fmtTime, truncate } from "@/lib/format";
import type { GraphNode } from "@/lib/graph-layout";
import { STATUS_GLOW } from "./nodes";

function accentFor(node: GraphNode): string {
  if (node.data.kind === "turn") return node.data.role === "user" ? "var(--glow-user)" : "var(--glow-pending)";
  return STATUS_GLOW[node.data.status];
}

export function DetailPanel({ node, onClose }: { node: GraphNode | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="absolute top-0 right-0 z-20 h-full w-[360px] max-w-[90vw] overflow-y-auto border-l border-[var(--glass-border)] p-4 shadow-[var(--shadow)] backdrop-blur-lg"
          style={{
            background: "var(--glass-bg)",
            boxShadow: `inset 4px 0 0 0 ${accentFor(node)}, var(--shadow)`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="mb-3 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 font-mono text-xs text-[var(--ink-muted)] hover:border-[var(--accent)]"
          >
            Close close
          </button>

          {node.data.kind === "turn" ? (
            <>
              <div className="mb-1 font-mono text-xs text-[var(--ink-muted)]">
                {node.data.role} / {fmtTime(node.data.timestamp)}
              </div>
              <div className="text-[13px] whitespace-pre-wrap">
                {node.data.role === "user" ? extractText(node.data.raw.message?.content) : node.data.label}
              </div>
            </>
          ) : (
            <>
              <div className="mb-1 font-mono text-sm font-semibold">{node.data.raw.name}</div>
              <div className="mb-3 font-mono text-xs text-[var(--ink-muted)]">
                {fmtTime(node.data.timestamp)} / {fmtDuration(node.data.raw.durationMs)}
              </div>
              <div className="mb-1 font-mono text-[11px] tracking-wide text-[var(--ink-muted)] uppercase">input</div>
              <pre className="mb-3 max-h-64 overflow-auto rounded-md bg-[var(--surface-2)] p-2 font-mono text-[11px] whitespace-pre-wrap">
                {JSON.stringify(node.data.raw.input, null, 2)}
              </pre>
              <div className="mb-1 font-mono text-[11px] tracking-wide text-[var(--ink-muted)] uppercase">result</div>
              <pre className="max-h-64 overflow-auto rounded-md bg-[var(--surface-2)] p-2 font-mono text-[11px] whitespace-pre-wrap">
                {node.data.raw.result
                  ? truncate(extractText(node.data.raw.result.content), 3000)
                  : "(no result yet - call is in flight)"}
              </pre>
              {node.data.raw.agentSummary && (
                <div className="mt-3 flex flex-wrap gap-3 font-mono text-[11px] tabular-nums text-[var(--ink-muted)]">
                  {node.data.raw.agentSummary.totalDurationMs != null && (
                    <span>
                      <b className="text-[var(--ink)]">{fmtDuration(node.data.raw.agentSummary.totalDurationMs)}</b>{" "}
                      runtime
                    </span>
                  )}
                  {node.data.raw.agentSummary.totalTokens != null && (
                    <span>
                      <b className="text-[var(--ink)]">{node.data.raw.agentSummary.totalTokens.toLocaleString()}</b>{" "}
                      tokens
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}



