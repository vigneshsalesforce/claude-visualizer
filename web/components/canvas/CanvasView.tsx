"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildScene, type SceneAgent, type SceneGraph } from "@/lib/canvas-scene";
import type { ProcessedTranscript } from "@/lib/transcript-parser";
import { HOLO } from "@/lib/holo";
import { AGENT_RADIUS, CAMERA, SATELLITE, resolveMonoFont } from "./animation-constants";
import { createDepthParticles, drawStarfield, updateDepthParticles, type DepthParticle } from "./starfield";
import { LiveBar } from "./LiveBar";
import { centerOn, createCamera, panBy, screenToScene, zoomAt, type CameraState } from "./camera";
import { DARK_THEME_COLORS, type ThemeColors } from "./theme-colors";
import { BloomRenderer } from "./bloom";
import { useSceneSimulation } from "./useSceneSimulation";
import { SatelliteLayout } from "./layout-satellites";
import { DiscoveryTracker, type Discovery } from "./discoveries";
import { drawAgents, type AgentPositions } from "./draw-agents";
import { drawToolCalls, type PlacedToolCall } from "./draw-tool-calls";
import { drawMessages, type PlacedMessage } from "./draw-messages";
import { drawEdges, getActiveEdges } from "./draw-edges";
import { drawParticles } from "./draw-particles";
import { drawDiscoveries } from "./draw-discoveries";
import { drawMinimap, minimapPointToScene } from "./minimap";
import { hitTest, type HitTarget } from "./hit-detection";
import { CanvasDetailPanel, type SelectedSceneItem } from "./CanvasDetailPanel";
import { ChatPanel } from "./ChatPanel";
import { FileAttentionPanel } from "./FileAttentionPanel";
import { CostPanel } from "./CostPanel";

interface CanvasViewProps {
  processed: ProcessedTranscript | null;
  subagentProcessed: Map<string, ProcessedTranscript>;
}

interface DragState {
  startX: number;
  startY: number;
  startCam: CameraState;
  moved: boolean;
}

interface AgentDragState {
  id: string;
  moved: boolean;
}

const TOOL_HIT_RADIUS = Math.hypot(SATELLITE.toolCardW, SATELLITE.toolCardH) / 2;
const MESSAGE_HIT_RADIUS = Math.hypot(SATELLITE.messageBubbleW, SATELLITE.messageBubbleH) / 2;

function ToggleButton({
  active,
  onClick,
  title,
  label,
  activeColor,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  label: string;
  activeColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className="focus-ring rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-all"
      style={{
        background: active ? (activeColor ? `${activeColor}26` : HOLO.toggleActive) : "transparent",
        color: active ? (activeColor ?? HOLO.holoBright) : HOLO.textMuted,
      }}
    >
      {label}
    </button>
  );
}

export function CanvasView({ processed, subagentProcessed }: CanvasViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<SelectedSceneItem | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showCost, setShowCost] = useState(false);

  const scene = useMemo(() => buildScene(processed, subagentProcessed), [processed, subagentProcessed]);
  const { positionsRef, sync, pinAgent, unpinAgent } = useSceneSimulation();

  const sceneRef = useRef<SceneGraph>(scene);
  const agentsByIdRef = useRef<Map<string, SceneAgent>>(new Map());
  const satelliteLayoutRef = useRef(new SatelliteLayout());
  const discoveryTrackerRef = useRef(new DiscoveryTracker());
  const discoveriesRef = useRef<Discovery[]>([]);
  const cssSizeRef = useRef({ width: 0, height: 0 });
  const cameraRef = useRef<CameraState>(createCamera());
  const colorsRef = useRef<ThemeColors | null>(null);
  const bloomRef = useRef<BloomRenderer | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const agentDragRef = useRef<AgentDragState | null>(null);
  const minimapDragRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const lastPlacedRef = useRef<{ tools: PlacedToolCall[]; messages: PlacedMessage[] }>({ tools: [], messages: [] });
  const starfieldRef = useRef<DepthParticle[]>([]);
  const lastFrameMsRef = useRef(0);

  useEffect(() => {
    sceneRef.current = scene;
    agentsByIdRef.current = new Map(scene.agents.map((a) => [a.id, a]));
    sync(scene);
    const discoveries = discoveryTrackerRef.current.sync(scene.toolCalls);
    discoveriesRef.current = discoveries;
    satelliteLayoutRef.current.sync(scene.toolCalls, scene.messages, discoveries);
  }, [scene, sync]);

  useEffect(() => {
    selectedIdRef.current = selected?.id ?? null;
  }, [selected]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    resolveMonoFont();
    colorsRef.current = DARK_THEME_COLORS;
    bloomRef.current = new BloomRenderer();

    const applySize = (width: number, height: number) => {
      cssSizeRef.current = { width, height };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      bloomRef.current?.resize(canvas.width, canvas.height);
      starfieldRef.current = createDepthParticles(width, height);
    };
    const rect = container.getBoundingClientRect();
    applySize(rect.width, rect.height);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      applySize(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(container);

    function hitAgentAt(x: number, y: number): string | null {
      const targets: HitTarget<string>[] = [];
      for (const agent of sceneRef.current.agents) {
        const pos = positionsRef.current.get(agent.id);
        if (pos) targets.push({ item: agent.id, x: pos.x, y: pos.y, radius: AGENT_RADIUS });
      }
      return hitTest(targets, x, y);
    }

    function pickAt(x: number, y: number): SelectedSceneItem | null {
      const targets: HitTarget<SelectedSceneItem>[] = [];
      for (const p of lastPlacedRef.current.tools) {
        targets.push({ item: p.toolCall, x: p.x, y: p.y, radius: TOOL_HIT_RADIUS });
      }
      for (const p of lastPlacedRef.current.messages) {
        targets.push({ item: p.message, x: p.x, y: p.y, radius: MESSAGE_HIT_RADIUS });
      }
      return hitTest(targets, x, y);
    }

    const onPointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      const miniHit = minimapPointToScene(localX, localY, positionsRef.current, cssSizeRef.current.width, cssSizeRef.current.height);
      if (miniHit) {
        minimapDragRef.current = true;
        cameraRef.current = centerOn(cameraRef.current, miniHit.x, miniHit.y);
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      const scenePt = screenToScene(cameraRef.current, cssSizeRef.current.width, cssSizeRef.current.height, localX, localY);
      const hitAgentId = hitAgentAt(scenePt.x, scenePt.y);
      if (hitAgentId) {
        agentDragRef.current = { id: hitAgentId, moved: false };
      } else {
        dragRef.current = { startX: e.clientX, startY: e.clientY, startCam: { ...cameraRef.current }, moved: false };
      }
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      if (minimapDragRef.current) {
        const miniHit = minimapPointToScene(localX, localY, positionsRef.current, cssSizeRef.current.width, cssSizeRef.current.height);
        if (miniHit) cameraRef.current = centerOn(cameraRef.current, miniHit.x, miniHit.y);
        return;
      }

      if (agentDragRef.current) {
        agentDragRef.current.moved = true;
        const scenePt = screenToScene(cameraRef.current, cssSizeRef.current.width, cssSizeRef.current.height, localX, localY);
        pinAgent(agentDragRef.current.id, scenePt.x, scenePt.y);
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      cameraRef.current = panBy(drag.startCam, dx, dy);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (minimapDragRef.current) {
        minimapDragRef.current = false;
        return;
      }

      if (agentDragRef.current) {
        const { id, moved } = agentDragRef.current;
        agentDragRef.current = null;
        if (moved) {
          unpinAgent(id);
        } else {
          setSelected(sceneRef.current.agents.find((a) => a.id === id) ?? null);
        }
        return;
      }

      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag || drag.moved) return;
      const rect = canvas.getBoundingClientRect();
      const scenePt = screenToScene(
        cameraRef.current,
        cssSizeRef.current.width,
        cssSizeRef.current.height,
        e.clientX - rect.left,
        e.clientY - rect.top
      );
      setSelected(pickAt(scenePt.x, scenePt.y));
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const factor = e.deltaY < 0 ? CAMERA.zoomStepUp : CAMERA.zoomStepDown;
      cameraRef.current = zoomAt(
        cameraRef.current,
        cssSizeRef.current.width,
        cssSizeRef.current.height,
        e.clientX - rect.left,
        e.clientY - rect.top,
        factor
      );
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    let rafId = 0;
    const frame = () => {
      const colors = colorsRef.current;
      if (!colors) {
        rafId = requestAnimationFrame(frame);
        return;
      }
      const { width, height } = cssSizeRef.current;
      const dpr = window.devicePixelRatio || 1;
      const cam = cameraRef.current;
      const now = Date.now();
      const deltaSeconds = lastFrameMsRef.current ? Math.min(0.1, (now - lastFrameMsRef.current) / 1000) : 0;
      lastFrameMsRef.current = now;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.save();
      ctx.scale(dpr, dpr);
      updateDepthParticles(starfieldRef.current, deltaSeconds, width, height);
      drawStarfield(ctx, width, height, starfieldRef.current, cam);
      ctx.restore();

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(width / 2 + cam.x, height / 2 + cam.y);
      ctx.scale(cam.zoom, cam.zoom);

      const currentScene = sceneRef.current;
      const agentsById = agentsByIdRef.current;
      const positions: AgentPositions = positionsRef.current;
      const satelliteLayout = satelliteLayoutRef.current;

      drawEdges(ctx, currentScene.edges, agentsById, positions, colors, now);
      drawParticles(ctx, getActiveEdges(currentScene.edges, agentsById), positions, now, colors);
      drawAgents(ctx, currentScene.agents, positions, colors, selectedIdRef.current, now);
      const placedTools = drawToolCalls(ctx, currentScene.toolCalls, satelliteLayout, positions, colors, selectedIdRef.current, now);
      const placedMessages = drawMessages(ctx, currentScene.messages, satelliteLayout, positions, colors, now);
      drawDiscoveries(ctx, discoveriesRef.current, satelliteLayout, positions, colors, now);
      lastPlacedRef.current = { tools: placedTools, messages: placedMessages };

      ctx.restore();
      bloomRef.current?.apply(canvas, ctx);

      ctx.save();
      ctx.scale(dpr, dpr);
      drawMinimap(ctx, positions, cam, width, height, colors);
      ctx.restore();

      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [positionsRef, pinAgent, unpinAgent]);

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100vh-8.5rem)] min-h-[520px] w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[#050510] shadow-[var(--shadow-strong)]"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
      {!processed && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[13px]"
          style={{ color: HOLO.textMuted }}
        >
          waiting for events...
        </div>
      )}

      <div
        className="absolute top-3 left-3 z-40 flex items-center gap-1 rounded px-1 py-0.5"
        style={{ background: HOLO.holoBg03, border: `1px solid ${HOLO.holoBorder06}` }}
      >
        <ToggleButton active={showChat} onClick={() => setShowChat((v) => !v)} title="Messages" label="Chat" />
        <ToggleButton active={showFiles} onClick={() => setShowFiles((v) => !v)} title="File attention" label="Files" />
        <ToggleButton
          active={showCost}
          onClick={() => setShowCost((v) => !v)}
          title="Tokens"
          label="Usage"
          activeColor={HOLO.complete}
        />
      </div>

      {showChat && <ChatPanel messages={scene.messages} onClose={() => setShowChat(false)} />}
      {showFiles && (
        <FileAttentionPanel
          toolCalls={scene.toolCalls}
          onClose={() => setShowFiles(false)}
          leftOffset={showChat ? 356 : 16}
        />
      )}
      {showCost && !selected && <CostPanel agents={scene.agents} processed={processed} onClose={() => setShowCost(false)} />}

      <LiveBar scene={scene} />
      <CanvasDetailPanel item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}





