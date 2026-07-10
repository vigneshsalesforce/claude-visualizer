"use client";

/**
 * Bottom control bar in the Agent Flow style: pulsing LIVE dot, elapsed
 * session time, and an event track with one dot per tool call / message.
 * There is no replay engine, so no Review/scrub controls — the bar is a
 * live activity readout only.
 */
import { useEffect, useMemo, useState } from "react";
import type { SceneGraph } from "@/lib/canvas-scene";
import { HOLO } from "@/lib/holo";

const MAX_DOTS = 120;
/** If nothing arrived for this long, treat the session as idle/historical. */
const IDLE_FREEZE_MS = 15_000;

interface TrackEvent {
  timeMs: number;
  color: string;
}

function collectEvents(scene: SceneGraph): TrackEvent[] {
  const events: TrackEvent[] = [];
  for (const tc of scene.toolCalls) {
    if (!tc.timestamp) continue;
    events.push({
      timeMs: new Date(tc.timestamp).getTime(),
      color: tc.status === "error" ? HOLO.error : HOLO.tool,
    });
  }
  for (const msg of scene.messages) {
    if (!msg.timestamp) continue;
    events.push({ timeMs: new Date(msg.timestamp).getTime(), color: HOLO.message });
  }
  events.sort((a, b) => a.timeMs - b.timeMs);
  if (events.length > MAX_DOTS) {
    const step = events.length / MAX_DOTS;
    const sampled: TrackEvent[] = [];
    for (let i = 0; i < MAX_DOTS; i++) sampled.push(events[Math.floor(i * step)]);
    return sampled;
  }
  return events;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LiveBar({ scene }: { scene: SceneGraph }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const events = useMemo(() => collectEvents(scene), [scene]);
  if (events.length === 0) return null;

  const firstMs = events[0].timeMs;
  const lastMs = events[events.length - 1].timeMs;
  const live = nowMs - lastMs < IDLE_FREEZE_MS;
  const endMs = live ? nowMs : lastMs;
  const duration = Math.max(1, endMs - firstMs);

  return (
    <div className="absolute bottom-4 left-4 right-4 z-50 mx-auto" style={{ maxWidth: 680 }}>
      <div
        className="flex items-center gap-3 rounded-lg px-5 py-3 backdrop-blur-md"
        style={{ background: HOLO.panelBg, border: `1px solid ${HOLO.glassBorder}` }}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${live ? "live-pulse" : ""}`}
          style={{ background: live ? HOLO.liveDot : HOLO.textMuted }}
        />
        <span
          className="shrink-0 font-mono text-[10px] font-semibold tracking-wider"
          style={{ color: live ? HOLO.liveText : HOLO.textMuted }}
        >
          {live ? "LIVE" : "IDLE"}
        </span>
        <span className="shrink-0 font-mono text-xs tabular-nums" style={{ color: HOLO.textPrimary }}>
          {formatElapsed(endMs - firstMs)}
        </span>

        <div className="relative h-[3px] flex-1 rounded-full" style={{ background: HOLO.holoBg10 }}>
          {events.map((evt, i) => (
            <span
              key={i}
              className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
              style={{
                left: `${((evt.timeMs - firstMs) / duration) * 100}%`,
                background: evt.color,
              }}
            />
          ))}
        </div>

        <span className="shrink-0 font-mono text-[10px] tabular-nums" style={{ color: HOLO.textMuted }}>
          {scene.toolCalls.length + scene.messages.length}
        </span>
      </div>
    </div>
  );
}
