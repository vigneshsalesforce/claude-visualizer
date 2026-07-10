"use client";

import { colorForLabel } from "@/lib/categorical-colors";

interface SessionInfo {
  path: string;
}

interface SessionTabsProps {
  sessions: Map<string, SessionInfo>;
  activeSessionId: string | null;
  onSelect: (id: string) => void;
}

function shortLabel(id: string): string {
  return id.slice(0, 8);
}

export function SessionTabs({ sessions, activeSessionId, onSelect }: SessionTabsProps) {
  if (sessions.size <= 1) return null;

  return (
    <div className="mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 shadow-[var(--shadow)] backdrop-blur-xl">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">sessions</span>
      {Array.from(sessions.entries()).map(([id, session]) => {
        const active = id === activeSessionId;
        const dotColor = colorForLabel(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            title={active ? `${session.path} (currently tracked)` : session.path}
            aria-current={active}
            className="focus-ring flex items-center gap-1.5 rounded border px-2 py-1 text-left font-mono text-[10px] transition-all"
            style={{
              borderColor: active ? "var(--accent)" : "var(--border)",
              background: active ? "color-mix(in srgb, var(--accent) 22%, transparent)" : "var(--surface-2)",
              color: active ? "var(--ink)" : "var(--ink-muted)",
              boxShadow: active
                ? "0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent), 0 0 10px color-mix(in srgb, var(--accent) 35%, transparent)"
                : "none",
              fontWeight: active ? 700 : 500,
            }}
          >
            <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: dotColor, boxShadow: `0 0 6px 1px ${dotColor}` }} />
            <span className="font-semibold" style={{ color: active ? "var(--ink)" : dotColor }}>
              {shortLabel(id)}
            </span>
            {active && (
              <span className="font-mono text-[9px] font-semibold tracking-wide uppercase" style={{ color: "var(--accent)" }}>
                current
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}



