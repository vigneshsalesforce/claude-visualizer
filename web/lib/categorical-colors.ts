/**
 * Fixed vivid palette for coloring things by *identity* (agent type, session
 * id) rather than by status. Status already has its own meaning (success/
 * error/pending use --success/--error/--accent-2) - this is the separate
 * "which one is this" dimension, hashed so the same label always lands on
 * the same color across renders and across the CSS-node and Canvas2D views.
 */
const PALETTE = [
  "#66ccff", // holo cyan
  "#cc88ff", // dispatch violet
  "#66ffaa", // return green
  "#ffbb44", // tool amber
  "#aaeeff", // holo bright
  "#ff88cc", // pink
  "#88ffdd", // mint
  "#ffaa66", // peach
  "#99aaff", // periwinkle
  "#ffee88", // gold
] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function colorForLabel(label: string): string {
  if (!label) return PALETTE[0];
  return PALETTE[hashString(label) % PALETTE.length];
}
