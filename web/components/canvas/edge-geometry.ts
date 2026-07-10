/**
 * Shared cubic-bézier geometry for edges and the particles that travel
 * along them (agent-flow's beam shape): control points at t=0.33/0.66,
 * offset perpendicular to the chord by dist * 0.15.
 */

export interface EdgeBezier {
  x0: number;
  y0: number;
  cp1x: number;
  cp1y: number;
  cp2x: number;
  cp2y: number;
  x1: number;
  y1: number;
}

export function edgeBezier(from: { x: number; y: number }, to: { x: number; y: number }): EdgeBezier {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const curvature = dist * 0.15;
  // Unit perpendicular to the chord.
  const px = -dy / dist;
  const py = dx / dist;
  return {
    x0: from.x,
    y0: from.y,
    cp1x: from.x + dx * 0.33 + px * curvature,
    cp1y: from.y + dy * 0.33 + py * curvature,
    cp2x: from.x + dx * 0.66 + px * curvature,
    cp2y: from.y + dy * 0.66 + py * curvature,
    x1: to.x,
    y1: to.y,
  };
}

/** Point on the cubic bézier at parameter t ∈ [0, 1]. */
export function bezierPoint(b: EdgeBezier, t: number): { x: number; y: number } {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * b.x0 + 3 * uu * t * b.cp1x + 3 * u * tt * b.cp2x + tt * t * b.x1,
    y: uu * u * b.y0 + 3 * uu * t * b.cp1y + 3 * u * tt * b.cp2y + tt * t * b.y1,
  };
}

/** Tangent (unnormalized) of the cubic bézier at t — for perpendicular wobble. */
export function bezierTangent(b: EdgeBezier, t: number): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: 3 * u * u * (b.cp1x - b.x0) + 6 * u * t * (b.cp2x - b.cp1x) + 3 * t * t * (b.x1 - b.cp2x),
    y: 3 * u * u * (b.cp1y - b.y0) + 6 * u * t * (b.cp2y - b.cp1y) + 3 * t * t * (b.y1 - b.cp2y),
  };
}
