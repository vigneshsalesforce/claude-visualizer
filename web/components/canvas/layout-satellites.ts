/**
 * Places tool-call and message cards around their owning agent's live
 * simulated position via a ring/angle search that avoids overlapping other
 * already-placed satellites of the same agent. Offsets are cached and kept
 * stable once assigned (searched once at placement time, not every frame)
 * so cards don't jitter as the owning agent drifts under the physics sim.
 */
import type { SceneMessage, SceneToolCall } from "@/lib/canvas-scene";
import type { Discovery } from "./discoveries";
import {
  MAX_VISIBLE_DISCOVERIES_PER_AGENT,
  MAX_VISIBLE_MESSAGES_PER_AGENT,
  MAX_VISIBLE_TOOL_CALLS_PER_AGENT,
  MESSAGE_FADE_MS,
  MESSAGE_HOLD_MS,
  SATELLITE,
} from "./animation-constants";

export interface SatelliteOffset {
  dx: number;
  dy: number;
  w: number;
  h: number;
}

type Point = { x: number; y: number };

function findSlot(existing: SatelliteOffset[], w: number, h: number): { dx: number; dy: number } {
  for (let ring = 1; ring <= SATELLITE.maxRings; ring++) {
    const dist = SATELLITE.baseDistance + ring * SATELLITE.ringIncrement;
    const steps = SATELLITE.baseSteps + ring * SATELLITE.stepsPerRing;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const overlaps = existing.some((o) => Math.abs(dx - o.dx) < (w + o.w) / 2 && Math.abs(dy - o.dy) < (h + o.h) / 2);
      if (!overlaps) return { dx, dy };
    }
  }
  const angle = Math.random() * Math.PI * 2;
  return { dx: Math.cos(angle) * SATELLITE.fallbackDistance, dy: Math.sin(angle) * SATELLITE.fallbackDistance };
}

function mostRecent<T extends { timestamp?: string }>(items: T[], max: number): T[] {
  return [...items]
    .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())
    .slice(0, max);
}

/** Owns the cache of satellite offsets. Call `sync()` whenever the scene's
 *  tool-calls/messages lists change (on the throttled structural update,
 *  not every animation frame). `resolve()` reads current placements for
 *  drawing/hit-testing, given the owning agents' live positions. */
export class SatelliteLayout {
  private offsets = new Map<string, { ownerAgentId: string; offset: SatelliteOffset }>();

  sync(toolCalls: SceneToolCall[], messages: SceneMessage[], discoveries: Discovery[] = []): void {
    const now = Date.now();
    const visibleMessages = messages.filter((m) => {
      const ts = m.timestamp ? new Date(m.timestamp).getTime() : now;
      return now - ts <= MESSAGE_HOLD_MS + MESSAGE_FADE_MS;
    });

    const byOwnerTools = groupBy(toolCalls, (t) => t.ownerAgentId);
    const byOwnerMsgs = groupBy(visibleMessages, (m) => m.ownerAgentId);
    const byOwnerDiscoveries = groupBy(discoveries, (d) => d.ownerAgentId);

    const activeIds = new Set<string>();
    for (const [ownerId, items] of byOwnerTools) {
      for (const t of mostRecent(items, MAX_VISIBLE_TOOL_CALLS_PER_AGENT)) {
        activeIds.add(t.id);
        this.ensurePlacement(t.id, ownerId, SATELLITE.toolCardW, SATELLITE.toolCardH);
      }
    }
    for (const [ownerId, items] of byOwnerMsgs) {
      for (const m of mostRecent(items, MAX_VISIBLE_MESSAGES_PER_AGENT)) {
        activeIds.add(m.id);
        this.ensurePlacement(m.id, ownerId, SATELLITE.messageBubbleW, SATELLITE.messageBubbleH);
      }
    }
    for (const [ownerId, items] of byOwnerDiscoveries) {
      const recent = [...items].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_VISIBLE_DISCOVERIES_PER_AGENT);
      for (const d of recent) {
        activeIds.add(d.id);
        this.ensurePlacement(d.id, ownerId, SATELLITE.discoveryCardW, SATELLITE.discoveryCardH);
      }
    }

    for (const id of this.offsets.keys()) {
      if (!activeIds.has(id)) this.offsets.delete(id);
    }
  }

  private ensurePlacement(id: string, ownerAgentId: string, w: number, h: number): void {
    if (this.offsets.has(id)) return;
    const existing = Array.from(this.offsets.values())
      .filter((v) => v.ownerAgentId === ownerAgentId)
      .map((v) => v.offset);
    const { dx, dy } = findSlot(existing, w, h);
    this.offsets.set(id, { ownerAgentId, offset: { dx, dy, w, h } });
  }

  /** Absolute scene-space position for a satellite, given its owner's live
   *  position, or null if this id isn't currently placed (capped out). */
  position(id: string, ownerPos: Point): Point | null {
    const entry = this.offsets.get(id);
    if (!entry) return null;
    return { x: ownerPos.x + entry.offset.dx, y: ownerPos.y + entry.offset.dy };
  }

  size(id: string): { w: number; h: number } | null {
    const entry = this.offsets.get(id);
    return entry ? { w: entry.offset.w, h: entry.offset.h } : null;
  }
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}



