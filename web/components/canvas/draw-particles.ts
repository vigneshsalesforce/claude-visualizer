import type { SceneEdge } from "@/lib/canvas-scene";
import { PARTICLES_PER_ACTIVE_EDGE, PARTICLE_SPEED } from "./animation-constants";
import { HOLO } from "@/lib/holo";
import type { ThemeColors } from "./theme-colors";
import type { AgentPositions } from "./draw-agents";
import { getAgentGlowSprite } from "./draw-hex";
import { bezierPoint, bezierTangent, edgeBezier } from "./edge-geometry";

const TRAIL_SEGMENTS = 8;
const TRAIL_SPACING = 0.02; // t-distance between trail segments
const WOBBLE_AMP = 3;
const WOBBLE_FREQ = 10;
const HEAD_RADIUS = 2.5;
const GLOW_RADIUS = 15;

/**
 * Comet particles flowing along active edges (agent-flow style): a glowing
 * head with a fading trail sampled backward along the same bézier the edge
 * is drawn with, wobbling perpendicular to the path.
 */
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  activeEdges: SceneEdge[],
  positions: AgentPositions,
  nowMs: number,
  colors: ThemeColors
): void {
  const t = nowMs / 1000;
  const color = colors.accent;

  for (const e of activeEdges) {
    const from = positions.get(e.source);
    const to = positions.get(e.target);
    if (!from || !to) continue;
    const b = edgeBezier(from, to);

    for (let i = 0; i < PARTICLES_PER_ACTIVE_EDGE; i++) {
      const phase = (t * PARTICLE_SPEED + i / PARTICLES_PER_ACTIVE_EDGE) % 1;

      const wobbleAt = (tt: number) => {
        const p = bezierPoint(b, tt);
        const tan = bezierTangent(b, tt);
        const len = Math.sqrt(tan.x * tan.x + tan.y * tan.y) || 1;
        const wobble = Math.sin(tt * WOBBLE_FREQ + i * 2.1) * WOBBLE_AMP;
        return { x: p.x + (-tan.y / len) * wobble, y: p.y + (tan.x / len) * wobble };
      };

      // Trail: shrinking, fading segments behind the head.
      ctx.save();
      for (let s = TRAIL_SEGMENTS; s >= 1; s--) {
        const tt = phase - s * TRAIL_SPACING;
        if (tt < 0) continue;
        const p = wobbleAt(tt);
        const frac = 1 - s / TRAIL_SEGMENTS;
        ctx.globalAlpha = 0.6 * frac;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, HEAD_RADIUS * (0.3 + 0.7 * frac), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Head: pre-rendered glow sprite + solid core + white-hot highlight.
      const head = wobbleAt(phase);
      const sprite = getAgentGlowSprite(color, 0, GLOW_RADIUS, "40");
      ctx.drawImage(sprite, head.x - GLOW_RADIUS, head.y - GLOW_RADIUS, GLOW_RADIUS * 2, GLOW_RADIUS * 2);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(head.x, head.y, HEAD_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = HOLO.holoHot + "80";
      ctx.beginPath();
      ctx.arc(head.x, head.y, HEAD_RADIUS * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
