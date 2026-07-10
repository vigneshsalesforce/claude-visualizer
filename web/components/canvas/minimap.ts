/**
 * Small hand-rolled overview in the bottom-right corner: agent positions as
 * dots, the current camera viewport as an outline rectangle, click-to-jump.
 * Drawn in screen space (after the camera transform is restored), on top of
 * the bloom composite so it stays crisp rather than glowing.
 */
import { HOLO } from "@/lib/holo";
import { screenToScene, type CameraState } from "./camera";
import type { ThemeColors } from "./theme-colors";
import type { AgentPositions } from "./draw-agents";
import { roundRect } from "./draw-tool-calls";

export const MINIMAP = { width: 160, height: 110, margin: 12, padding: 24 } as const;

function rectOrigin(cssWidth: number, cssHeight: number): { x: number; y: number } {
  return { x: cssWidth - MINIMAP.width - MINIMAP.margin, y: cssHeight - MINIMAP.height - MINIMAP.margin };
}

function computeBounds(positions: AgentPositions): { minX: number; minY: number; scale: number } | null {
  const pts = Array.from(positions.values());
  if (pts.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const innerW = MINIMAP.width - MINIMAP.padding;
  const innerH = MINIMAP.height - MINIMAP.padding;
  const scale = Math.min(innerW / spanX, innerH / spanY);
  return { minX, minY, scale };
}

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  positions: AgentPositions,
  camera: CameraState,
  cssWidth: number,
  cssHeight: number,
  colors: ThemeColors
): void {
  const { x: rectX, y: rectY } = rectOrigin(cssWidth, cssHeight);

  ctx.save();
  roundRect(ctx, rectX, rectY, MINIMAP.width, MINIMAP.height, 8);
  ctx.fillStyle = HOLO.panelBg;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = HOLO.glassBorder;
  ctx.stroke();

  const bounds = computeBounds(positions);
  if (!bounds) {
    ctx.restore();
    return;
  }
  const { minX, minY, scale } = bounds;
  const toMini = (x: number, y: number) => ({
    x: rectX + MINIMAP.padding / 2 + (x - minX) * scale,
    y: rectY + MINIMAP.padding / 2 + (y - minY) * scale,
  });

  ctx.fillStyle = colors.accent;
  for (const p of positions.values()) {
    const m = toMini(p.x, p.y);
    ctx.beginPath();
    ctx.arc(m.x, m.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const corners: [number, number][] = [
    [0, 0],
    [cssWidth, 0],
    [cssWidth, cssHeight],
    [0, cssHeight],
  ];
  ctx.beginPath();
  corners.forEach(([sx, sy], i) => {
    const scenePt = screenToScene(camera, cssWidth, cssHeight, sx, sy);
    const m = toMini(scenePt.x, scenePt.y);
    if (i === 0) ctx.moveTo(m.x, m.y);
    else ctx.lineTo(m.x, m.y);
  });
  ctx.closePath();
  ctx.strokeStyle = HOLO.holoBase + "80";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

/** Returns scene-space coords for a click inside the minimap rect, or null
 *  if the click missed it (caller should fall through to normal picking). */
export function minimapPointToScene(
  px: number,
  py: number,
  positions: AgentPositions,
  cssWidth: number,
  cssHeight: number
): { x: number; y: number } | null {
  const { x: rectX, y: rectY } = rectOrigin(cssWidth, cssHeight);
  if (px < rectX || px > rectX + MINIMAP.width || py < rectY || py > rectY + MINIMAP.height) return null;

  const bounds = computeBounds(positions);
  if (!bounds) return null;
  const { minX, minY, scale } = bounds;
  return {
    x: minX + (px - rectX - MINIMAP.padding / 2) / scale,
    y: minY + (py - rectY - MINIMAP.padding / 2) / scale,
  };
}



