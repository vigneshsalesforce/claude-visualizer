import type { SceneMessage } from "@/lib/canvas-scene";
import { HOLO } from "@/lib/holo";
import { MESSAGE_FADE_MS, MESSAGE_HOLD_MS, MONO_FONT, SATELLITE } from "./animation-constants";
import type { ThemeColors } from "./theme-colors";
import type { SatelliteLayout } from "./layout-satellites";
import type { AgentPositions } from "./draw-agents";
import { roundRect } from "./draw-tool-calls";
import { drawSatelliteLink } from "./draw-satellite-links";

export interface PlacedMessage {
  message: SceneMessage;
  x: number;
  y: number;
}

/** Draws transient message bubbles: fade in, hold, fade out. Returns
 *  positions of the still-visible ones, for hit-testing. */
export function drawMessages(
  ctx: CanvasRenderingContext2D,
  messages: SceneMessage[],
  layout: SatelliteLayout,
  agentPositions: AgentPositions,
  colors: ThemeColors,
  now: number
): PlacedMessage[] {
  const placed: PlacedMessage[] = [];
  const { messageBubbleW: w, messageBubbleH: h } = SATELLITE;

  for (const msg of messages) {
    const ownerPos = agentPositions.get(msg.ownerAgentId);
    if (!ownerPos) continue;
    const pos = layout.position(msg.id, ownerPos);
    if (!pos) continue;

    const age = msg.timestamp ? now - new Date(msg.timestamp).getTime() : 0;
    const alpha = fadeAlpha(age);
    if (alpha <= 0) continue;

    placed.push({ message: msg, x: pos.x, y: pos.y });
    const accent = msg.role === "user" ? colors.user : colors.accent;

    drawSatelliteLink(ctx, ownerPos.x, ownerPos.y, pos.x, pos.y, alpha * 0.3);

    ctx.save();
    ctx.globalAlpha = alpha;
    roundRect(ctx, pos.x - w / 2, pos.y - h / 2, w, h, 4);
    ctx.fillStyle = HOLO.toolCardBg;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = accent + "60";
    ctx.stroke();

    ctx.font = `9px ${MONO_FONT}`;
    ctx.fillStyle = HOLO.textPrimary;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const text = (msg.role === "user" ? "you: " : "claude: ") + truncate(msg.text.replace(/\s+/g, " ").trim(), 26);
    ctx.fillText(text, pos.x - w / 2 + 8, pos.y);
    ctx.restore();
  }

  return placed;
}

function fadeAlpha(ageMs: number): number {
  if (ageMs < 0) return 0;
  if (ageMs < MESSAGE_FADE_MS) return ageMs / MESSAGE_FADE_MS;
  if (ageMs < MESSAGE_HOLD_MS) return 1;
  const fadeOutAge = ageMs - MESSAGE_HOLD_MS;
  if (fadeOutAge < MESSAGE_FADE_MS) return 1 - fadeOutAge / MESSAGE_FADE_MS;
  return 0;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "..." : s || "...";
}



