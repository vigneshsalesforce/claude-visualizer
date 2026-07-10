"use client";

import { useEffect, useRef } from "react";
import type { SceneMessage } from "@/lib/canvas-scene";
import { fmtTime, truncate } from "@/lib/format";
import { HOLO } from "@/lib/holo";

// Canvas overlay - sits on the always-dark canvas viewport, so (like
// LiveBar/CostPanel) it uses the fixed HOLO dark palette rather than
// theme-reactive CSS vars, which would go muddy against the black canvas.
export function ChatPanel({ messages, onClose }: { messages: SceneMessage[]; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  return (
    <div
      className="absolute top-14 left-0 z-20 flex h-[calc(100%-3.5rem)] w-[340px] max-w-[88vw] flex-col rounded-tr-xl backdrop-blur-md"
      style={{ background: HOLO.panelBg, border: `1px solid ${HOLO.glassBorder}`, borderLeft: "none", borderBottom: "none" }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${HOLO.glassBorder}` }}>
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: HOLO.holoBase }}>
            stream
          </div>
          <div className="text-sm font-semibold" style={{ color: HOLO.textPrimary }}>
            Messages
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="focus-ring rounded-md px-2 py-1 font-mono text-[11px] transition-colors"
          style={{ border: `1px solid ${HOLO.glassBorder}`, background: HOLO.holoBg05, color: HOLO.textMuted }}
        >
          Close
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="mt-4 text-center font-mono text-[11px]" style={{ color: HOLO.textMuted }}>
            no messages yet
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className="mb-2 rounded-lg border px-3 py-2 text-[12px]"
            style={{ borderColor: m.role === "user" ? HOLO.holoBase : HOLO.dispatch, background: HOLO.toolCardBg }}
          >
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: HOLO.textMuted }}>
              {m.role === "user" ? "you" : "claude"} / {fmtTime(m.timestamp)}
            </div>
            <div className="whitespace-pre-wrap" style={{ color: HOLO.textPrimary }}>
              {truncate(m.text.trim() || "...", 240)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



