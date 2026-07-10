/**
 * All tunables for the Canvas2D physics view in one place, so visual tuning
 * doesn't require hunting across draw modules.
 */

export const FORCE = {
  chargeStrength: -900,
  centerStrength: 0.03,
  collideRadius: 90,
  linkDistance: 220,
  linkStrength: 0.5,
  alphaDecay: 0.03,
  velocityDecay: 0.45,
} as const;

export const AGENT_RADIUS = 28;

/** Hexagon node geometry (agent-flow NODE constants). */
export const HEX = {
  rootRadius: 28,
  subRadius: 20,
  /** Center icon scale relative to node radius. */
  iconScale: 0.45,
} as const;

/** Breathe/scanline animation tunables (agent-flow ANIM). */
export const NODE_ANIM = {
  breatheSpeedRunning: 2,
  breatheAmpRunning: 0.03,
  breatheSpeedIdle: 0.7,
  breatheAmpIdle: 0.015,
  scanlineSpeedRunning: 40,
  scanlineSpeedIdle: 15,
  scanlineHalfHeight: 4,
} as const;

export const SATELLITE = {
  toolCardW: 132,
  toolCardH: 30,
  messageBubbleW: 190,
  messageBubbleH: 34,
  discoveryCardW: 170,
  discoveryCardH: 28,
  maxRings: 5,
  baseDistance: 85,
  ringIncrement: 32,
  baseSteps: 5,
  stepsPerRing: 2,
  fallbackDistance: 85,
} as const;

/** Caps concurrently-placed satellites per agent so the overlap-avoidance
 *  search in layout-satellites.ts stays cheap on long sessions - older
 *  entries age out the same way message bubbles fade, rather than the
 *  search degrading toward O(n^2) against an unbounded set. */
export const MAX_VISIBLE_TOOL_CALLS_PER_AGENT = 12;
export const MAX_VISIBLE_MESSAGES_PER_AGENT = 3;
export const MAX_VISIBLE_DISCOVERIES_PER_AGENT = 4;

export const MESSAGE_HOLD_MS = 6000;
export const MESSAGE_FADE_MS = 400;
export const TOOL_FADE_MS = 250;
export const DISCOVERY_HOLD_MS = 8000;
export const DISCOVERY_FADE_MS = 500;

export const PARTICLE_SPEED = 0.35; // fraction of edge length traveled per second
export const PARTICLES_PER_ACTIVE_EDGE = 3;

export const CAMERA = {
  minZoom: 0.25,
  maxZoom: 3,
  zoomStepDown: 0.9,
  zoomStepUp: 1.1,
} as const;

export const BLOOM = {
  intensity: 0.6,
  blurRadii: [8, 6, 4] as const,
  scale: 0.5,
} as const;

/** Caps the render loop near 60fps (1ms slack for timing jitter). */
export const MIN_FRAME_INTERVAL_MS = 1000 / 60 - 1;

/** How often structural simulation changes are allowed to trigger a React
 *  re-render - the canvas itself repaints every frame via a plain ref. */
export const UI_THROTTLE_MS = 250;

/**
 * Canvas `font` strings can't resolve CSS custom properties like
 * `var(--font-mono)`, and next/font generates hashed family names — so the
 * real Geist Mono family is resolved from the CSS var at canvas init via
 * resolveMonoFont(). Importers see the updated value through the live ES
 * module binding.
 */
export let MONO_FONT = "ui-monospace, Menlo, Consolas, monospace";

export function resolveMonoFont(): void {
  if (typeof document === "undefined") return;
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim();
  if (family) MONO_FONT = `${family}, ui-monospace, monospace`;
}



