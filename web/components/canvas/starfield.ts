/**
 * Void background with drifting depth particles (parallax "starfield"),
 * ported from Agent Flow's background-layer.ts. Drawn in screen space
 * before the camera transform is applied.
 */
import { HOLO } from "@/lib/holo";
import type { CameraState } from "./camera";

export interface DepthParticle {
  x: number;
  y: number;
  size: number;
  brightness: number;
  speed: number;
  depth: number;
}

const NUM_PARTICLES = 80;

export function createDepthParticles(width: number, height: number): DepthParticle[] {
  const particles: DepthParticle[] = [];
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push({
      x: Math.random() * width * 2 - width * 0.5,
      y: Math.random() * height * 2 - height * 0.5,
      size: Math.random() * 1.5 + 0.5,
      brightness: Math.random() * 0.3 + 0.05,
      speed: Math.random() * 0.15 + 0.05,
      depth: Math.random(),
    });
  }
  return particles;
}

export function updateDepthParticles(
  particles: DepthParticle[],
  deltaSeconds: number,
  width: number,
  height: number
): void {
  for (const p of particles) {
    p.x += p.speed * deltaSeconds * 10 * (1 - p.depth * 0.5);
    p.y -= p.speed * deltaSeconds * 5 * (1 - p.depth * 0.3);
    if (p.x > width * 1.5) p.x = -width * 0.5;
    if (p.y < -height * 0.5) p.y = height * 1.5;
  }
}

function alphaToHex(alpha: number): string {
  return Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
}

export function drawStarfield(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  particles: DepthParticle[],
  camera: CameraState
): void {
  ctx.fillStyle = HOLO.void;
  ctx.fillRect(0, 0, width, height);

  for (const p of particles) {
    const parallaxFactor = 0.3 + p.depth * 0.7;
    const px = p.x + camera.x * parallaxFactor * 0.1;
    const py = p.y + camera.y * parallaxFactor * 0.1;
    const size = p.size * (0.5 + p.depth * 0.5);
    const alpha = p.brightness * (0.5 + p.depth * 0.5);

    ctx.beginPath();
    ctx.fillStyle = HOLO.holoBase + alphaToHex(alpha);
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
}
