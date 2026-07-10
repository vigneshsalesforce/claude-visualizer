/**
 * Distance-based click/hover picking against the same position data used
 * for drawing - there are no DOM elements per node in the canvas view, so
 * hit-testing has to be done manually against scene-space coordinates.
 */
export interface HitTarget<T> {
  item: T;
  x: number;
  y: number;
  /** Circle hit radius (or a half-diagonal approximation for rect cards). */
  radius: number;
}

/**
 * Returns the topmost target whose hit circle contains (px, py), or null.
 * Callers should order `targets` back-to-front (draw order) - this walks in
 * reverse so whatever was drawn last (topmost) wins on overlap.
 */
export function hitTest<T>(targets: HitTarget<T>[], px: number, py: number): T | null {
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    const dx = px - t.x;
    const dy = py - t.y;
    if (dx * dx + dy * dy <= t.radius * t.radius) return t.item;
  }
  return null;
}



