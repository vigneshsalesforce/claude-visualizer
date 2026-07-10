/**
 * Classic subtree-width tree layout: compute each subtree's width bottom-up,
 * then position children left-to-right centered under their parent,
 * top-down (root at y=0, children below) - matching the MuleSoft Agent
 * Visualizer's top-down org-chart look, unlike graph-layout.ts's
 * left-to-right chronological layout.
 */
import type { Edge, Node } from "@xyflow/react";
import type { TreeNode } from "@/lib/tree-scene";

export interface TreeCardData {
  node: TreeNode;
  [key: string]: unknown;
}

export const NODE_W = 200;
const X_GAP = 30;
const Y_STEP = 140;

function subtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) return NODE_W;
  const childrenWidth = node.children.reduce((sum, c) => sum + subtreeWidth(c), 0) + X_GAP * (node.children.length - 1);
  return Math.max(NODE_W, childrenWidth);
}

function place(node: TreeNode, xLeft: number, depth: number, nodes: Node[], edges: Edge[], parentId?: string): void {
  const width = subtreeWidth(node);
  let childX = xLeft;
  for (const child of node.children) {
    place(child, childX, depth + 1, nodes, edges, node.id);
    childX += subtreeWidth(child) + X_GAP;
  }
  const centerX = xLeft + width / 2;

  nodes.push({
    id: node.id,
    type: "treeCard",
    position: { x: centerX - NODE_W / 2, y: depth * Y_STEP },
    data: { node } as TreeCardData,
  });

  if (parentId) {
    edges.push({
      id: `e-${parentId}-${node.id}`,
      source: parentId,
      target: node.id,
      type: "default",
      style: { stroke: "var(--border)", strokeWidth: 1.5 },
    });
  }
}

export function buildTreeLayout(root: TreeNode | null): { nodes: Node[]; edges: Edge[] } {
  if (!root) return { nodes: [], edges: [] };
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  place(root, 0, 0, nodes, edges);
  return { nodes, edges };
}



