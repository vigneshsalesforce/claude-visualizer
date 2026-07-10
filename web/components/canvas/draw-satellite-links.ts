import { HOLO } from "@/lib/holo";

/** Thin connector from an agent to one of its orbiting tool-call cards or
 *  message bubbles - makes ownership legible when several agents' satellites
 *  are close together on screen. */
export function drawSatelliteLink(
  ctx: CanvasRenderingContext2D,
  ownerX: number,
  ownerY: number,
  x: number,
  y: number,
  alpha: number
): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = HOLO.holoBorder12;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ownerX, ownerY);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
}
