"use client";

import { AnimatePresence, motion } from "motion/react";
import type { SceneAgent, SceneMessage, SceneToolCall } from "@/lib/canvas-scene";
import { extractText } from "@/lib/transcript-parser";
import { fmtDuration, fmtTime, truncate } from "@/lib/format";
import { HOLO } from "@/lib/holo";
import { agentStatusColor, toolStatusColor, DARK_THEME_COLORS } from "./theme-colors";

export type SelectedSceneItem = SceneAgent | SceneToolCall | SceneMessage;

// This panel is a canvas overlay - it sits on top of the always-dark canvas
// viewport, so (like LiveBar/CostPanel) it uses the fixed HOLO dark palette
// rather than theme-reactive CSS vars, which would go muddy against the
// black canvas in light mode.
function ToolCallDetail({ toolCall }: { toolCall: SceneToolCall }) {
  const raw = toolCall.raw;
  return (
    <>
      <div className="mb-1 font-mono text-sm font-semibold" style={{ color: HOLO.textPrimary }}>
        {raw.name}
      </div>
      <div className="mb-3 font-mono text-xs" style={{ color: HOLO.textMuted }}>
        {fmtTime(raw.callTimestamp)} / {fmtDuration(raw.durationMs)}
      </div>
      <div className="mb-1 font-mono text-[11px] tracking-wide uppercase" style={{ color: HOLO.textMuted }}>
        input
      </div>
      <pre
        className="mb-3 max-h-64 overflow-auto rounded-md p-2 font-mono text-[11px] whitespace-pre-wrap"
        style={{ background: HOLO.toolCardBg, color: HOLO.textPrimary }}
      >
        {JSON.stringify(raw.input, null, 2)}
      </pre>
      <div className="mb-1 font-mono text-[11px] tracking-wide uppercase" style={{ color: HOLO.textMuted }}>
        result
      </div>
      <pre
        className="max-h-64 overflow-auto rounded-md p-2 font-mono text-[11px] whitespace-pre-wrap"
        style={{ background: HOLO.toolCardBg, color: HOLO.textPrimary }}
      >
        {raw.result ? truncate(extractText(raw.result.content), 3000) : "(no result yet - call is in flight)"}
      </pre>
    </>
  );
}

function AgentDetail({ agent }: { agent: SceneAgent }) {
  const tc = agent.dispatchToolCall;
  return (
    <>
      <div className="mb-1 font-mono text-sm font-semibold" style={{ color: agentStatusColor(DARK_THEME_COLORS, agent.status) }}>
        {agent.label}
      </div>
      <div className="mb-3 font-mono text-xs" style={{ color: HOLO.textMuted }}>
        agent / depth {agent.depth} / {agent.status}
      </div>
      {tc ? (
        <>
          <div className="mb-1 font-mono text-[11px] tracking-wide uppercase" style={{ color: HOLO.textMuted }}>
            dispatch input
          </div>
          <pre
            className="mb-3 max-h-64 overflow-auto rounded-md p-2 font-mono text-[11px] whitespace-pre-wrap"
            style={{ background: HOLO.toolCardBg, color: HOLO.textPrimary }}
          >
            {JSON.stringify(tc.input, null, 2)}
          </pre>
          {tc.agentSummary && (
            <div className="flex flex-wrap gap-3 font-mono text-[11px] tabular-nums" style={{ color: HOLO.textMuted }}>
              {tc.agentSummary.totalDurationMs != null && (
                <span>
                  <b style={{ color: HOLO.textPrimary }}>{fmtDuration(tc.agentSummary.totalDurationMs)}</b> runtime
                </span>
              )}
              {tc.agentSummary.totalTokens != null && (
                <span>
                  <b style={{ color: HOLO.textPrimary }}>{tc.agentSummary.totalTokens.toLocaleString()}</b> tokens
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-[13px]" style={{ color: HOLO.textMuted }}>
          The root Claude Code session.
        </div>
      )}
    </>
  );
}

function MessageDetail({ message }: { message: SceneMessage }) {
  return (
    <>
      <div className="mb-1 font-mono text-xs" style={{ color: HOLO.textMuted }}>
        {message.role} / {fmtTime(message.timestamp)}
      </div>
      <div className="text-[13px] whitespace-pre-wrap" style={{ color: HOLO.textPrimary }}>
        {message.role === "user" ? extractText(message.raw.message?.content) : message.text}
      </div>
    </>
  );
}

export function CanvasDetailPanel({ item, onClose }: { item: SelectedSceneItem | null; onClose: () => void }) {
  const accent =
    item &&
    (item.kind === "agent"
      ? agentStatusColor(DARK_THEME_COLORS, item.status)
      : item.kind === "tool"
        ? toolStatusColor(DARK_THEME_COLORS, item.status)
        : HOLO.holoBase);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="absolute top-0 right-0 z-20 h-full w-[380px] max-w-[92vw] overflow-y-auto p-5 backdrop-blur-md"
          style={{
            background: HOLO.panelBg,
            borderLeft: `1px solid ${HOLO.glassBorder}`,
            boxShadow: `inset 4px 0 0 0 ${accent}, 0 0 40px rgba(0, 0, 0, 0.5)`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="focus-ring mb-4 rounded-md px-2.5 py-1.5 font-mono text-[11px] font-semibold transition-colors"
            style={{ border: `1px solid ${HOLO.glassBorder}`, background: HOLO.holoBg05, color: HOLO.textMuted }}
          >
            Close
          </button>

          {item.kind === "agent" ? <AgentDetail agent={item} /> : item.kind === "tool" ? <ToolCallDetail toolCall={item} /> : <MessageDetail message={item} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}




