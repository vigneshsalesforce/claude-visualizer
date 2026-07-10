/**
 * Hand-rolled pan/zoom camera for the canvas view. Deliberately not backed
 * by d3-zoom - a plain 2D affine transform (translate + uniform scale) is
 * all this needs, and hand-rolling it avoids a second d3 module with its own
 * event/coordinate-system conventions layered on top of the physics sim.
 */
import { CAMERA } from "./animation-constants";

export interface CameraState {
  x: number; // pan offset, screen px
  y: number;
  zoom: number;
}

export function createCamera(): CameraState {
  return { x: 0, y: 0, zoom: 1 };
}

/** Screen-space pointer coords -> scene-space coords (inverse of the
 *  translate+scale transform applied before drawing). */
export function screenToScene(
  cam: CameraState,
  canvasWidth: number,
  canvasHeight: number,
  sx: number,
  sy: number
): { x: number; y: number } {
  return {
    x: (sx - canvasWidth / 2 - cam.x) / cam.zoom,
    y: (sy - canvasHeight / 2 - cam.y) / cam.zoom,
  };
}

export function sceneToScreen(
  cam: CameraState,
  canvasWidth: number,
  canvasHeight: number,
  x: number,
  y: number
): { x: number; y: number } {
  return {
    x: x * cam.zoom + cam.x + canvasWidth / 2,
    y: y * cam.zoom + cam.y + canvasHeight / 2,
  };
}

export function panBy(cam: CameraState, dx: number, dy: number): CameraState {
  return { ...cam, x: cam.x + dx, y: cam.y + dy };
}

/** Re-centers the camera so scene point (x, y) lands at the canvas center,
 *  keeping the current zoom level - used for minimap click/drag-to-jump. */
export function centerOn(cam: CameraState, x: number, y: number): CameraState {
  return { ...cam, x: -x * cam.zoom, y: -y * cam.zoom };
}

/** Zooms by `factor` (>1 = in, <1 = out) while keeping the scene point under
 *  (sx, sy) fixed on screen, clamped to [minZoom, maxZoom]. */
export function zoomAt(cam: CameraState, canvasWidth: number, canvasHeight: number, sx: number, sy: number, factor: number): CameraState {
  const before = screenToScene(cam, canvasWidth, canvasHeight, sx, sy);
  const zoom = Math.min(CAMERA.maxZoom, Math.max(CAMERA.minZoom, cam.zoom * factor));
  const next: CameraState = { ...cam, zoom };
  const after = sceneToScreen(next, canvasWidth, canvasHeight, before.x, before.y);
  next.x += sx - after.x;
  next.y += sy - after.y;
  return next;
}



