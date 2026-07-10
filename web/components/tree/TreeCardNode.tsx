"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "motion/react";
import type { NodeBadge } from "@/lib/tree-scene";
import type { GraphStatus } from "@/lib/graph-layout";
import { colorForLabel } from "@/lib/categorical-colors";
import type { TreeCardData } from "./tree-layout";
import { NODE_W } from "./tree-layout";

const BADGE_STYLE: Record<NodeBadge, { bg: string; fg: string }> = {
  Agent: { bg: "color-mix(in srgb, var(--subagent) 18%, var(--surface))", fg: "var(--subagent)" },
  MCP: { bg: "color-mix(in srgb, var(--user) 18%, var(--surface))", fg: "var(--user)" },
  Skill: { bg: "color-mix(in srgb, var(--accent-2) 18%, var(--surface))", fg: "var(--accent-2)" },
  Tool: { bg: "var(--surface-2)", fg: "var(--ink-muted)" },
};

const BADGE_ICON: Record<NodeBadge, string> = { Agent: "\u{1F916}", MCP: "\u{1F50C}", Skill: "\u{1F9E9}", Tool: "\u{1F527}" };

const STATUS_ACCENT: Record<GraphStatus, string> = {
  ok: "var(--success)",
  error: "var(--error)",
  pending: "var(--accent)",
  none: "var(--border)",
};

export function TreeCardNode({ data, selected }: NodeProps & { data: TreeCardData }) {
  const { node } = data;
  const badgeStyle =
    node.badge === "Agent"
      ? { bg: `${colorForLabel(node.name)}26`, fg: colorForLabel(node.name) }
      : BADGE_STYLE[node.badge];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="rounded-xl border bg-[var(--surface)] px-3 py-2.5 shadow-[var(--shadow)]"
      style={{
        width: NODE_W,
        borderTopColor: selected ? "var(--accent)" : "var(--border)",
        borderRightColor: selected ? "var(--accent)" : "var(--border)",
        borderBottomColor: selected ? "var(--accent)" : "var(--border)",
        borderLeftColor: STATUS_ACCENT[node.status],
        borderTopWidth: selected ? 2 : 1,
        borderRightWidth: selected ? 2 : 1,
        borderBottomWidth: selected ? 2 : 1,
        borderLeftWidth: 3,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "var(--border)", border: "none" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "var(--border)", border: "none" }} />

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px]"
            style={{ background: badgeStyle.bg }}
          >
            {BADGE_ICON[node.badge]}
          </span>
          <span className="truncate text-[13px] font-semibold text-[var(--ink)]">{node.name}</span>
        </div>
        <span
          className="flex-none rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap"
          style={{ background: badgeStyle.bg, color: badgeStyle.fg }}
        >
          {node.badge}
        </span>
      </div>

      <div className="mt-1.5 pl-9 font-mono text-[11px] text-[var(--ink-muted)]">
        {node.platform}
        {node.callCount > 1 ? ` / ${node.callCount}x` : ""}
      </div>
    </motion.div>
  );
}



