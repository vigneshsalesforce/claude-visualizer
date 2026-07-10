/**
 * Holographic design tokens ported from Agent Flow (patoles/agent-flow,
 * web/lib/colors.ts). These are the agent-flow-specific colors that don't map
 * onto the app's generic CSS-variable roles (--accent, --success, ...): amber
 * tool borders, dispatch purple, the green token pill, glass alphas. Draw
 * modules and panels import HOLO directly; role colors still come from
 * ThemeColors / CSS vars.
 */
export const HOLO = {
  // Base
  void: "#050510",
  hexGrid: "#0d0d1f",
  holoBase: "#66ccff",
  holoBright: "#aaeeff",
  holoHot: "#ffffff",
  textPrimary: "#aaeeff",
  textDim: "#66ccff90",
  textMuted: "#66ccff50",
  nodeInterior: "rgba(10, 15, 40, 0.5)",

  // Agent states
  idle: "#66ccff",
  thinking: "#66ccff",
  toolCalling: "#ffbb44",
  complete: "#66ffaa",
  error: "#ff5566",
  waiting: "#ffaa33",
  paused: "#888899",

  // Edge / particle types
  dispatch: "#cc88ff",
  return: "#66ffaa",
  tool: "#ffbb44",
  message: "#66ccff",

  // Glass / panels
  glassBg: "rgba(10, 15, 30, 0.7)",
  glassBorder: "rgba(100, 200, 255, 0.15)",
  panelBg: "rgba(8, 12, 24, 0.85)",
  panelSeparator: "rgba(100, 200, 255, 0.04)",
  holoBg03: "rgba(100, 200, 255, 0.03)",
  holoBg05: "rgba(100, 200, 255, 0.05)",
  holoBg10: "rgba(100, 200, 255, 0.10)",
  holoBorder06: "rgba(100, 200, 255, 0.06)",
  holoBorder08: "rgba(100, 200, 255, 0.08)",
  holoBorder10: "rgba(100, 200, 255, 0.10)",
  holoBorder12: "rgba(100, 200, 255, 0.12)",

  // Toggles / tabs
  toggleActive: "rgba(100, 200, 255, 0.15)",
  toggleInactive: "rgba(100, 200, 255, 0.05)",
  toggleBorder: "rgba(100, 200, 255, 0.10)",
  tabSelectedBg: "rgba(100, 200, 255, 0.15)",
  tabSelectedBorder: "rgba(100, 200, 255, 0.30)",
  tabInactiveBg: "rgba(100, 200, 255, 0.03)",
  tabInactiveBorder: "rgba(100, 200, 255, 0.08)",

  // Live bar
  liveDot: "#ff4444",
  liveText: "#ff6666",

  // Token/cost pill
  costText: "#66ffaa",
  costPillBg: "rgba(10, 20, 40, 0.75)",
  costPillStroke: "rgba(102, 255, 170, 0.3)",

  // Tool cards
  toolCardBg: "rgba(10, 15, 30, 0.7)",
  toolCardErrorBg: "rgba(40, 10, 15, 0.8)",
} as const;

/**
 * Append a 2-digit hex alpha to a 6-digit hex color (agent-flow's `color+'60'`
 * idiom). Only valid for #rrggbb inputs.
 */
export function alphaHex(hex: string, alpha: string): string {
  return hex + alpha;
}
