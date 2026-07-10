"use client";

import { useMemo, useState } from "react";
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, type NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildGraph, type GraphNode } from "@/lib/graph-layout";
import type { ProcessedTranscript } from "@/lib/transcript-parser";
import { TurnNode, ToolNode, AgentNode } from "./nodes";
import { DetailPanel } from "./DetailPanel";

const nodeTypes = { turn: TurnNode, tool: ToolNode, agent: AgentNode };

interface GraphViewProps {
  processed: ProcessedTranscript | null;
  subagentProcessed: Map<string, ProcessedTranscript>;
}

function GraphViewInner({ processed, subagentProcessed }: GraphViewProps) {
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const { nodes, edges } = useMemo(() => {
    if (!processed) return { nodes: [], edges: [] };
    return buildGraph(processed, subagentProcessed);
  }, [processed, subagentProcessed]);

  const onNodeClick: NodeMouseHandler = (_event, node) => {
    setSelected(node as GraphNode);
  };

  if (!processed) {
    return <div className="mt-4 font-mono text-[13px] text-[var(--ink-muted)]">waiting for events...</div>;
  }

  return (
    <div className="graph-glass-scope relative h-[calc(100vh-6rem)] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)]">
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, color-mix(in srgb, var(--accent) 10%, transparent) 0%, transparent 60%)",
        }}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        proOptions={{ hideAttribution: true }}
        colorMode="system"
      >
        <Background color="var(--border)" gap={26} size={1} bgColor="transparent" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            const kind = (n.data as { kind?: string }).kind;
            if (kind === "agent") return "var(--subagent)";
            if (kind === "tool") return "var(--ink-muted)";
            return "var(--accent)";
          }}
          maskColor="color-mix(in srgb, var(--bg) 70%, transparent)"
        />
      </ReactFlow>
      <DetailPanel node={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export function GraphView(props: GraphViewProps) {
  return (
    <ReactFlowProvider>
      <GraphViewInner {...props} />
    </ReactFlowProvider>
  );
}



