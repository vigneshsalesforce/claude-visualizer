import type { SceneAgent, SceneEdge } from "@/lib/canvas-scene";
import { HOLO } from "@/lib/holo";
import type { ThemeColors } from "./theme-colors";
import type { AgentPositions } from "./draw-agents";
import { bezierPoint, bezierTangent, edgeBezier, type EdgeBezier } from "./edge-geometry";

const BEAM_SEGMENTS = 16;
const START_WIDTH = 3;
const END_WIDTH = 1;

/**
 * Draws a tapered beam (agent-flow style): a closed polygon built from two
 * offset samplings of the same cubic bézier, wider at the source.
 */
function drawTaperedBeam(
  ctx: CanvasRenderingContext2D,
  b: EdgeBezier,
  startW: number,
  endW: number,
  color: string,
  alpha: number
): void {
  const upper: Array<{ x: number; y: number }> = [];
  const lower: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= BEAM_SEGMENTS; i++) {
    const t = i / BEAM_SEGMENTS;
    const p = bezierPoint(b, t);
    const tan = bezierTangent(b, t);
    const len = Math.sqrt(tan.x * tan.x + tan.y * tan.y) || 1;
    const nx = -tan.y / len;
    const ny = tan.x / len;
    const halfW = (startW + (endW - startW) * t) / 2;
    upper.push({ x: p.x + nx * halfW, y: p.y + ny * halfW });
    lower.push({ x: p.x - nx * halfW, y: p.y - ny * halfW });
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(upper[0].x, upper[0].y);
  for (let i = 1; i < upper.length; i++) ctx.lineTo(upper[i].x, upper[i].y);
  for (let i = lower.length - 1; i >= 0; i--) ctx.lineTo(lower[i].x, lower[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawEdges(
  ctx: CanvasRenderingContext2D,
  edges: SceneEdge[],
  agentsById: Map<string, SceneAgent>,
  positions: AgentPositions,
  colors: ThemeColors,
  now: number
): void {
  const t = now / 1000;

  for (const e of edges) {
    const from = positions.get(e.source);
    const to = positions.get(e.target);
    const targetAgent = agentsById.get(e.target);
    if (!from || !to || !targetAgent) continue;

    const active = targetAgent.status === "running";
    const color = active ? colors.accent : targetAgent.status === "error" ? colors.error : HOLO.dispatch;
    const b = edgeBezier(from, to);

    if (active) {
      const pulse = Math.sin(t * 4) * 0.1 + 0.9;
      // Wide faint glow beam under the core beam.
      drawTaperedBeam(ctx, b, START_WIDTH * 3, END_WIDTH * 3, color, 0.08);
      drawTaperedBeam(ctx, b, START_WIDTH, END_WIDTH, color, 0.3 * pulse);
    } else {
      drawTaperedBeam(ctx, b, START_WIDTH * 0.7, END_WIDTH * 0.7, color, 0.08);
    }
  }
}

/** Edges whose target agent is still running - these get particle flow. */
export function getActiveEdges(edges: SceneEdge[], agentsById: Map<string, SceneAgent>): SceneEdge[] {
  return edges.filter((e) => agentsById.get(e.target)?.status === "running");
}
