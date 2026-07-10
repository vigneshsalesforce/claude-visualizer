"use client";

import { useMemo, useState } from "react";
import { Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow, type NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildTree, flattenTree } from "@/lib/tree-scene";
import type { ProcessedTranscript } from "@/lib/transcript-parser";
import { buildTreeLayout, NODE_W } from "./tree-layout";
import { TreeCardNode } from "./TreeCardNode";
import { TreeDetailPanel } from "./TreeDetailPanel";

const nodeTypes = { treeCard: TreeCardNode };

interface TreeViewProps {
  processed: ProcessedTranscript | null;
  subagentProcessed: Map<string, ProcessedTranscript>;
}

function TreeViewInner({ processed, subagentProcessed }: TreeViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { setCenter, getZoom } = useReactFlow();

  const root = useMemo(() => buildTree(processed, subagentProcessed), [processed, subagentProcessed]);
  const nodesById = useMemo(() => flattenTree(root), [root]);
  const { nodes, edges } = useMemo(() => buildTreeLayout(root), [root]);
  const nodesWithSelection = useMemo(
    () => nodes.map((n) => ({ ...n, selected: n.id === selectedId })),
    [nodes, selectedId]
  );

  const onNodeClick: NodeMouseHandler = (_event, node) => {
    setSelectedId(node.id);
  };

  const jumpTo = (id: string) => {
    setSelectedId(id);
    const target = nodes.find((n) => n.id === id);
    if (target) {
      setCenter(target.position.x + NODE_W / 2, target.position.y + 30, { zoom: Math.max(getZoom(), 0.8), duration: 400 });
    }
  };

  if (!root) {
    return <div className="mt-4 font-mono text-[13px] text-[var(--ink-muted)]">waiting for events...</div>;
  }

  return (
    <div className="tree-flat-scope relative h-[calc(100vh-6rem)] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)]">
      <ReactFlow
        nodes={nodesWithSelection}
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
        <Background color="var(--border)" gap={28} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <TreeDetailPanel
        node={selectedId ? (nodesById.get(selectedId) ?? null) : null}
        onClose={() => setSelectedId(null)}
        onSelectId={jumpTo}
      />
    </div>
  );
}

export function TreeView(props: TreeViewProps) {
  return (
    <ReactFlowProvider>
      <TreeViewInner {...props} />
    </ReactFlowProvider>
  );
}



