import { HOLO } from "@/lib/holo";
import { DISCOVERY_FADE_MS, DISCOVERY_HOLD_MS, MONO_FONT, SATELLITE } from "./animation-constants";
import type { ThemeColors } from "./theme-colors";
import type { SatelliteLayout } from "./layout-satellites";
import type { AgentPositions } from "./draw-agents";
import type { Discovery } from "./discoveries";
import { roundRect } from "./draw-tool-calls";

function fadeAlpha(ageMs: number): number {
  if (ageMs < 0) return 0;
  if (ageMs < DISCOVERY_FADE_MS) return ageMs / DISCOVERY_FADE_MS;
  if (ageMs < DISCOVERY_HOLD_MS) return 1;
  const fadeOutAge = ageMs - DISCOVERY_HOLD_MS;
  if (fadeOutAge < DISCOVERY_FADE_MS) return 1 - fadeOutAge / DISCOVERY_FADE_MS;
  return 0;
}

function truncate(s: string, n: number): string {
  return s.length > n ? "..." + s.slice(-n) : s;
}

/** Draws fading "discovery" cards - a new file path a Grep/Glob call
 *  surfaced - near their owning agent. */
export function drawDiscoveries(
  ctx: CanvasRenderingContext2D,
  discoveries: Discovery[],
  layout: SatelliteLayout,
  agentPositions: AgentPositions,
  colors: ThemeColors,
  now: number
): void {
  const { discoveryCardW: w, discoveryCardH: h } = SATELLITE;

  for (const d of discoveries) {
    const ownerPos = agentPositions.get(d.ownerAgentId);
    if (!ownerPos) continue;
    const pos = layout.position(d.id, ownerPos);
    if (!pos) continue;

    const alpha = fadeAlpha(now - d.timestamp);
    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.setLineDash([3, 3]);
    roundRect(ctx, pos.x - w / 2, pos.y - h / 2, w, h, 4);
    ctx.fillStyle = HOLO.toolCardBg;
    ctx.fill();
    ctx.strokeStyle = colors.subagent + "60";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = `8px ${MONO_FONT}`;
    ctx.fillStyle = HOLO.textDim;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("search " + truncate(d.path, 20), pos.x - w / 2 + 6, pos.y);
    ctx.restore();
  }
}



