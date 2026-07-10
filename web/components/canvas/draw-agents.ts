import type { SceneAgent } from "@/lib/canvas-scene";
import { HOLO } from "@/lib/holo";
import { HEX, MONO_FONT, NODE_ANIM } from "./animation-constants";
import { agentStatusColor, type ThemeColors } from "./theme-colors";
import { drawClaudeSpark, drawHexagon, getAgentGlowSprite } from "./draw-hex";
import { roundRect } from "./draw-tool-calls";

export type AgentPositions = Map<string, { x: number; y: number }>;

export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  return n < 10_000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n / 1000)}k`;
}

export function agentRadius(agent: SceneAgent): number {
  return agent.depth === 0 ? HEX.rootRadius : HEX.subRadius;
}

export function drawAgents(
  ctx: CanvasRenderingContext2D,
  agents: SceneAgent[],
  positions: AgentPositions,
  colors: ThemeColors,
  selectedId: string | null,
  now: number
): void {
  const t = now / 1000;

  for (const agent of agents) {
    const pos = positions.get(agent.id);
    if (!pos) continue;
    const stateColor = agentStatusColor(colors, agent.status);
    const running = agent.status === "running";
    const selected = agent.id === selectedId;

    // Breathe: running nodes pulse harder than settled ones.
    const breathe = running
      ? Math.sin(t * NODE_ANIM.breatheSpeedRunning) * NODE_ANIM.breatheAmpRunning + 1
      : Math.sin(t * NODE_ANIM.breatheSpeedIdle) * NODE_ANIM.breatheAmpIdle + 1;
    const r = agentRadius(agent) * breathe;

    // Depth shadow.
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 5;
    drawHexagon(ctx, pos.x, pos.y, r * 0.9);
    ctx.fillStyle = HOLO.nodeInterior;
    ctx.fill();
    ctx.restore();

    // Glow sprite behind the node.
    const glowAlpha = selected ? "59" : running ? "33" : "1a"; // 0.35 / 0.2 / 0.1
    const glowR = r + 20;
    const sprite = getAgentGlowSprite(stateColor, r * 0.5, glowR, glowAlpha);
    ctx.drawImage(sprite, pos.x - glowR, pos.y - glowR, glowR * 2, glowR * 2);

    // Interior fill + ambient outer ring.
    drawHexagon(ctx, pos.x, pos.y, r * 0.9);
    ctx.fillStyle = HOLO.nodeInterior;
    ctx.fill();
    drawHexagon(ctx, pos.x, pos.y, r + 3);
    ctx.strokeStyle = stateColor + "25";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Scrolling scanline band, clipped to the hex.
    ctx.save();
    drawHexagon(ctx, pos.x, pos.y, r * 0.9);
    ctx.clip();
    const scanSpeed = running ? NODE_ANIM.scanlineSpeedRunning : NODE_ANIM.scanlineSpeedIdle;
    const scanY = pos.y - r + ((t * scanSpeed) % (r * 2));
    const half = NODE_ANIM.scanlineHalfHeight;
    const band = ctx.createLinearGradient(0, scanY - half, 0, scanY + half);
    band.addColorStop(0, stateColor + "00");
    band.addColorStop(0.5, stateColor + "20");
    band.addColorStop(1, stateColor + "00");
    ctx.fillStyle = band;
    ctx.fillRect(pos.x - r, scanY - half, r * 2, half * 2);
    ctx.restore();

    // State ring: solid while running, dashed when complete.
    ctx.save();
    drawHexagon(ctx, pos.x, pos.y, r);
    ctx.lineWidth = selected ? 2.5 : 2;
    if (agent.status === "done") {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = stateColor + "60";
    } else {
      ctx.strokeStyle = stateColor;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (selected) {
      drawHexagon(ctx, pos.x, pos.y, r + 6);
      ctx.strokeStyle = HOLO.holoHot + "80";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // Center icon: Claude spark for the root session, glyph for subagents.
    if (agent.depth === 0) {
      drawClaudeSpark(ctx, pos.x, pos.y, r, stateColor + "90", HEX.iconScale);
    } else {
      ctx.save();
      ctx.font = `${Math.round(r * HEX.iconScale * 1.6)}px ${MONO_FONT}`;
      ctx.fillStyle = stateColor + "90";
      ctx.shadowColor = stateColor;
      ctx.shadowBlur = 6;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(running ? "⚙" : "◇", pos.x, pos.y + 1);
      ctx.restore();
    }

    // Label under the node.
    ctx.font = `10px ${MONO_FONT}`;
    ctx.fillStyle = selected ? HOLO.textPrimary : HOLO.textDim;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(truncateLabel(agent.label, 16), pos.x, pos.y + r + 8);

    // Token bar + "Nk / 200k tokens" under the label.
    if (agent.tokensUsed != null && agent.tokensUsed > 0) {
      const barW = Math.max(60, r * 2.2);
      const barH = 6;
      const barX = pos.x - barW / 2;
      const barY = pos.y + r + 22;
      const frac = Math.min(1, agent.tokensUsed / agent.tokensMax);

      roundRect(ctx, barX, barY, barW, barH, 3);
      ctx.fillStyle = HOLO.holoBg05;
      ctx.fill();
      ctx.strokeStyle = HOLO.glassBorder;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      if (frac > 0) {
        const fillColor = frac > 0.9 ? colors.error : frac > 0.8 ? HOLO.toolCalling : HOLO.holoBase;
        roundRect(ctx, barX, barY, Math.max(barH, barW * frac), barH, 3);
        ctx.fillStyle = fillColor + "80";
        ctx.fill();
      }

      ctx.font = `7px ${MONO_FONT}`;
      ctx.fillStyle = HOLO.textMuted;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(
        `${formatTokens(agent.tokensUsed)} / ${formatTokens(agent.tokensMax)} tokens`,
        pos.x,
        barY + barH + 3
      );

      // Token pill above the node (agent-flow's cost pill, tokens instead of $).
      const pillLabel = `${formatTokens(agent.tokensUsed)} tok`;
      ctx.font = `bold 9px ${MONO_FONT}`;
      const pillW = ctx.measureText(pillLabel).width + 12;
      const pillH = 16;
      const pillY = pos.y - r - 22;
      roundRect(ctx, pos.x - pillW / 2, pillY - pillH / 2, pillW, pillH, 8);
      ctx.fillStyle = HOLO.costPillBg;
      ctx.fill();
      ctx.strokeStyle = HOLO.costPillStroke;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = HOLO.costText;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pillLabel, pos.x, pillY + 0.5);
    }
  }
}

function truncateLabel(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
