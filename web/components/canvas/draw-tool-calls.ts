import type { SceneToolCall } from "@/lib/canvas-scene";
import { HOLO } from "@/lib/holo";
import { MONO_FONT, TOOL_FADE_MS } from "./animation-constants";
import type { ThemeColors } from "./theme-colors";
import type { SatelliteLayout } from "./layout-satellites";
import type { AgentPositions } from "./draw-agents";
import { drawSatelliteLink } from "./draw-satellite-links";

export interface PlacedToolCall {
  toolCall: SceneToolCall;
  x: number;
  y: number;
}

const MIN_W = 60;
const MAX_W = 160;
const H_ONE_LINE = 24;
const H_TWO_LINE = 30;

/** Best-effort primary argument for the "Edit: jest.config.ts" label shape. */
function toolArgSummary(tc: SceneToolCall): string {
  const input = tc.raw.input;
  const candidate =
    input.file_path ?? input.path ?? input.pattern ?? input.command ?? input.query ?? input.url ?? input.skill;
  if (typeof candidate !== "string" || !candidate) return "";
  // Paths: keep the tail, it's the informative part.
  const cleaned = candidate.replace(/\\/g, "/");
  const parts = cleaned.split("/");
  return parts.length > 2 ? parts.slice(-2).join("/") : cleaned;
}

/** Draws every currently-placed tool-call card and returns their positions,
 *  reused by hit-detection so picking matches exactly what's drawn. */
export function drawToolCalls(
  ctx: CanvasRenderingContext2D,
  toolCalls: SceneToolCall[],
  layout: SatelliteLayout,
  agentPositions: AgentPositions,
  colors: ThemeColors,
  selectedId: string | null,
  now: number
): PlacedToolCall[] {
  const placed: PlacedToolCall[] = [];
  const t = now / 1000;

  for (const tc of toolCalls) {
    const ownerPos = agentPositions.get(tc.ownerAgentId);
    if (!ownerPos) continue;
    const pos = layout.position(tc.id, ownerPos);
    if (!pos) continue;
    placed.push({ toolCall: tc, x: pos.x, y: pos.y });

    const selected = tc.id === selectedId;
    const error = tc.status === "error";
    const running = tc.status === "pending";
    const age = tc.timestamp ? now - new Date(tc.timestamp).getTime() : TOOL_FADE_MS;
    const fadeIn = Math.min(1, age / TOOL_FADE_MS);

    drawSatelliteLink(ctx, ownerPos.x, ownerPos.y, pos.x, pos.y, fadeIn * 0.3);

    const arg = toolArgSummary(tc);
    const label = error ? `${tc.name}: FAILED` : arg ? `${tc.name}: ${arg}` : tc.name;
    const secondLine = error ? "" : tc.duration;
    const twoLine = !running && !!secondLine;

    ctx.save();
    ctx.globalAlpha = fadeIn;
    ctx.font = `8px ${MONO_FONT}`;
    const w = Math.max(MIN_W, Math.min(MAX_W, ctx.measureText(label).width + 12));
    const h = twoLine ? H_TWO_LINE : H_ONE_LINE;
    const x = pos.x - w / 2;
    const y = pos.y - h / 2;

    // Card fill + state border.
    if (error) {
      const pulse = Math.sin(t * 6) * 0.5 + 0.5;
      ctx.shadowColor = HOLO.error;
      ctx.shadowBlur = 8 + pulse * 4;
      roundRect(ctx, x, y, w, h, 4);
      ctx.fillStyle = HOLO.toolCardErrorBg;
      ctx.fill();
      ctx.strokeStyle = HOLO.error + "90";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      drawCracks(ctx, tc.id, pos.x, pos.y, w, h);
    } else {
      roundRect(ctx, x, y, w, h, 4);
      ctx.fillStyle = selected ? "rgba(100, 200, 255, 0.15)" : HOLO.toolCardBg;
      ctx.fill();
      ctx.strokeStyle = selected
        ? HOLO.holoBase + "aa"
        : running
          ? HOLO.tool + "60"
          : HOLO.return + "40";
      ctx.lineWidth = selected ? 1.5 : 1;
      ctx.stroke();
    }

    // Spinning arc ring while running.
    if (running) {
      const ringR = Math.max(w, h) / 2 + 4;
      const start = t * 3;
      ctx.strokeStyle = HOLO.tool + "50";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, ringR, h / 2 + 6, 0, start, start + Math.PI * 1.2);
      ctx.stroke();
    }

    // Text.
    ctx.textAlign = "left";
    const textX = x + 6;
    const labelColor = error ? HOLO.error : running ? HOLO.tool : HOLO.return;
    ctx.fillStyle = labelColor;
    if (twoLine) {
      ctx.textBaseline = "middle";
      ctx.fillText(truncateToWidth(ctx, label, w - 12), textX, y + 10);
      ctx.font = `6px ${MONO_FONT}`;
      ctx.fillStyle = HOLO.tool + "90";
      ctx.fillText(secondLine, textX, y + 21);
    } else {
      ctx.textBaseline = "middle";
      ctx.fillText(truncateToWidth(ctx, label, w - 12), textX, pos.y);
    }
    ctx.restore();
  }

  return placed;
}

/** Short red fracture lines radiating from the card center on failure. */
function drawCracks(ctx: CanvasRenderingContext2D, id: string, cx: number, cy: number, w: number, h: number): void {
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) | 0;
  ctx.strokeStyle = HOLO.error + "70";
  ctx.lineWidth = 0.75;
  for (let i = 0; i < 3; i++) {
    const angle = ((Math.abs(seed + i * 7919) % 628) / 100) as number;
    const len = Math.min(w, h) * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len * 0.5);
    ctx.stroke();
  }
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + "…").width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo) + "…" : "…";
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
