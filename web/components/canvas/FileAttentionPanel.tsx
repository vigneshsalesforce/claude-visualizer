"use client";

import type { SceneToolCall } from "@/lib/canvas-scene";
import { HOLO } from "@/lib/holo";

const FILE_KEY: Record<string, string> = {
  Read: "file_path",
  Edit: "file_path",
  Write: "file_path",
  NotebookEdit: "file_path",
  Grep: "path",
  Glob: "path",
};

function extractPath(tc: SceneToolCall): string | null {
  const key = FILE_KEY[tc.raw.name];
  if (!key) return null;
  const val = tc.raw.input[key];
  return typeof val === "string" && val ? val : null;
}

export function FileAttentionPanel({
  toolCalls,
  onClose,
  leftOffset = 16,
}: {
  toolCalls: SceneToolCall[];
  onClose: () => void;
  /** Left inset in px - pushed past the Chat panel when it's open so the two don't overlap. */
  leftOffset?: number;
}) {
  const counts = new Map<string, number>();
  for (const tc of toolCalls) {
    const p = extractPath(tc);
    if (!p) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const max = sorted[0]?.[1] ?? 1;

  return (
    <div
      className="absolute right-4 bottom-4 z-[25] max-h-[220px] overflow-y-auto rounded-xl px-4 py-3 backdrop-blur-md transition-[left] duration-200"
      style={{ left: leftOffset, background: HOLO.panelBg, border: `1px solid ${HOLO.glassBorder}` }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: HOLO.holoBase }}>
            working set
          </div>
          <div className="text-sm font-semibold" style={{ color: HOLO.textPrimary }}>
            File attention
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
      {sorted.length === 0 ? (
        <div className="font-mono text-[11px]" style={{ color: HOLO.textMuted }}>
          no file activity yet
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map(([filePath, count]) => (
            <div key={filePath} className="grid grid-cols-[minmax(8rem,45%)_1fr_2rem] items-center gap-2">
              <span className="truncate font-mono text-[11px]" style={{ color: HOLO.textPrimary }} title={filePath}>
                {filePath}
              </span>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: HOLO.holoBorder08 }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(count / max) * 100}%`, background: `linear-gradient(90deg, ${HOLO.holoBase}, ${HOLO.toolCalling})` }}
                />
              </div>
              <span className="text-right font-mono text-[10px]" style={{ color: HOLO.textMuted }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



