"use client";

import { useEffect, useRef } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { SceneGraph } from "@/lib/canvas-scene";
import { FORCE } from "./animation-constants";
import type { AgentPositions } from "./draw-agents";

interface ForceNode extends SimulationNodeDatum {
  id: string;
}
type ForceLink = SimulationLinkDatum<ForceNode>;

/**
 * Owns a single d3-force `Simulation` instance across renders. Agents are
 * the only physics bodies (tool calls/messages are satellites placed by
 * `layout-satellites.ts`, not simulated). Positions are written to a plain
 * ref on every tick - not React state - so the canvas can redraw at 60fps
 * without triggering component re-renders; `sync()` diffs the scene's
 * agents/edges against the simulation's live node/link arrays in place
 * (push/delete, never rebuild wholesale) so a structural scene update
 * (arriving up to ~4/sec from the SSE-driven transcript reprocessing
 * upstream in page.tsx) doesn't reset positions and make the layout jump.
 */
export function useSceneSimulation() {
  const simRef = useRef<Simulation<ForceNode, ForceLink> | null>(null);
  const nodesRef = useRef<Map<string, ForceNode>>(new Map());
  const positionsRef = useRef<AgentPositions>(new Map());

  useEffect(() => {
    const sim = forceSimulation<ForceNode, ForceLink>([])
      .force("charge", forceManyBody().strength(FORCE.chargeStrength))
      .force("center", forceCenter(0, 0).strength(FORCE.centerStrength))
      .force("collide", forceCollide(FORCE.collideRadius))
      .force(
        "link",
        forceLink<ForceNode, ForceLink>([])
          .id((d) => d.id)
          .distance(FORCE.linkDistance)
          .strength(FORCE.linkStrength)
      )
      .alphaDecay(FORCE.alphaDecay)
      .velocityDecay(FORCE.velocityDecay)
      .on("tick", () => {
        for (const node of sim.nodes()) {
          if (node.x != null && node.y != null) {
            positionsRef.current.set(node.id, { x: node.x, y: node.y });
          }
        }
      });

    simRef.current = sim;
    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, []);

  const sync = (scene: SceneGraph) => {
    const sim = simRef.current;
    if (!sim) return;

    const currentIds = new Set(scene.agents.map((a) => a.id));
    let structuralChange = scene.agents.length !== nodesRef.current.size;

    for (const id of nodesRef.current.keys()) {
      if (!currentIds.has(id)) {
        nodesRef.current.delete(id);
        positionsRef.current.delete(id);
        structuralChange = true;
      }
    }

    for (const agent of scene.agents) {
      if (nodesRef.current.has(agent.id)) continue;
      const spawnNear = agent.parentId ? positionsRef.current.get(agent.parentId) : undefined;
      const x = (spawnNear?.x ?? 0) + (Math.random() - 0.5) * 60;
      const y = (spawnNear?.y ?? 0) + (Math.random() - 0.5) * 60;
      const node: ForceNode = { id: agent.id, x, y };
      nodesRef.current.set(agent.id, node);
      positionsRef.current.set(agent.id, { x, y });
      structuralChange = true;
    }

    sim.nodes(Array.from(nodesRef.current.values()));

    const links: ForceLink[] = scene.edges.map((e) => ({ source: e.source, target: e.target }));
    const linkForce = sim.force("link") as ReturnType<typeof forceLink<ForceNode, ForceLink>> | undefined;
    if (linkForce) {
      if (links.length !== linkForce.links().length) structuralChange = true;
      linkForce.links(links);
    }

    if (structuralChange) sim.alpha(0.5).restart();
  };

  /** Pins an agent at a fixed scene position while the user is dragging it -
   *  d3-force respects `fx`/`fy` and stops simulating that node's position. */
  const pinAgent = (id: string, x: number, y: number) => {
    const node = nodesRef.current.get(id);
    if (!node) return;
    node.fx = x;
    node.fy = y;
    positionsRef.current.set(id, { x, y });
    simRef.current?.alpha(0.3).restart();
  };

  /** Releases a pinned agent back into the simulation on drag end. */
  const unpinAgent = (id: string) => {
    const node = nodesRef.current.get(id);
    if (!node) return;
    node.fx = null;
    node.fy = null;
    simRef.current?.alpha(0.3).restart();
  };

  return { positionsRef, sync, pinAgent, unpinAgent };
}



