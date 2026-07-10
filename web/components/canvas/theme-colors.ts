/**
 * Canvas 2D fillStyle/strokeStyle can't resolve `var(--x)` the way DOM CSS
 * can - colors have to be read as computed values once (and re-read on an
 * OS theme change) and passed into the draw modules as plain strings.
 */
import type { GraphStatus } from "@/lib/graph-layout";
import type { SceneAgentStatus } from "@/lib/canvas-scene";

export interface ThemeColors {
  bg: string;
  surface: string;
  border: string;
  ink: string;
  inkMuted: string;
  accent: string;
  user: string;
  success: string;
  error: string;
  subagent: string;
}

const VARS: Record<keyof ThemeColors, string> = {
  bg: "--bg",
  surface: "--surface",
  border: "--border",
  ink: "--ink",
  inkMuted: "--ink-muted",
  accent: "--accent",
  user: "--user",
  success: "--success",
  error: "--error",
  subagent: "--subagent",
};

/**
 * The CSS minifier shortens hex colors (#ff5566 -> #f56), and custom
 * properties come back as authored - but draw modules append 2-digit alpha
 * suffixes (`color + "60"`), which is only valid on 6-digit hex. Expand
 * shorthand back to the full form.
 */
function expandHex(color: string): string {
  const m = /^#([0-9a-fA-F]{3,4})$/.exec(color);
  if (!m) return color;
  return "#" + [...m[1]].map((c) => c + c).join("");
}

export function resolveThemeColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const out = {} as ThemeColors;
  for (const key of Object.keys(VARS) as (keyof ThemeColors)[]) {
    out[key] = expandHex(style.getPropertyValue(VARS[key]).trim()) || "#888888";
  }
  return out;
}

/**
 * The 2D canvas viewport (starfield, agents, edges, minimap) is a fixed
 * dark "cockpit" - its background never leaves #050510 regardless of the
 * app's light/dark toggle. Drawing it with `resolveThemeColors()` would
 * pick up the light palette's ink-on-white colors and render them
 * near-invisible against that permanently black canvas, so draw modules use
 * this static dark palette instead. `resolveThemeColors()` is still used by
 * DOM-based canvas overlays (e.g. CanvasDetailPanel) that carry their own
 * theme-reactive background.
 */
export const DARK_THEME_COLORS: ThemeColors = {
  bg: "#050510",
  surface: "#0a0f1e",
  border: "rgba(100, 200, 255, 0.15)",
  ink: "#aaeeff",
  inkMuted: "#66ccff90",
  accent: "#66ccff",
  user: "#66ccff",
  success: "#66ffaa",
  error: "#ff5566",
  subagent: "#cc88ff",
};

export function agentStatusColor(colors: ThemeColors, status: SceneAgentStatus): string {
  if (status === "running") return colors.accent;
  if (status === "error") return colors.error;
  return colors.success;
}

export function toolStatusColor(colors: ThemeColors, status: GraphStatus): string {
  if (status === "pending") return colors.accent;
  if (status === "error") return colors.error;
  if (status === "ok") return colors.success;
  return colors.border;
}



