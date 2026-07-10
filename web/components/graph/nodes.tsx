"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "motion/react";
import type { GraphStatus, ToolNodeData, TurnNodeData } from "@/lib/graph-layout";
import { fmtTime, truncate } from "@/lib/format";
import { colorForLabel } from "@/lib/categorical-colors";

export const STATUS_BORDER: Record<GraphStatus, string> = {
  ok: "color-mix(in srgb, var(--success) 55%, var(--border))",
  error: "color-mix(in srgb, var(--error) 55%, var(--border))",
  pending: "color-mix(in srgb, var(--accent-2) 60%, var(--border))",
  none: "var(--border)",
};

export const STATUS_GLOW: Record<GraphStatus, string> = {
  ok: "var(--glow-ok)",
  error: "var(--glow-error)",
  pending: "var(--glow-pending)",
  none: "transparent",
};

function NodeShell({
  accent,
  borderColor,
  glowColor,
  pulsing,
  children,
}: {
  accent: string;
  borderColor: string;
  glowColor: string;
  pulsing?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={`w-44 rounded-lg border-2 px-2.5 py-2 shadow-[var(--shadow)] backdrop-blur-md ${pulsing ? "pulse-glow" : ""}`}
      style={
        {
          borderColor,
          background: "var(--glass-bg)",
          boxShadow: pulsing ? undefined : `0 0 12px 1px ${glowColor}`,
          "--node-glow-color": glowColor,
        } as React.CSSProperties
      }
    >
      <Handle type="target" position={Position.Left} style={{ background: "var(--border)", border: "none" }} />
      <Handle type="source" position={Position.Right} style={{ background: "var(--border)", border: "none" }} />
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 flex-none rounded-full" style={{ background: accent, boxShadow: `0 0 6px 1px ${accent}` }} />
        {children}
      </div>
    </motion.div>
  );
}

export function TurnNode({ data }: NodeProps & { data: TurnNodeData }) {
  const isUser = data.role === "user";
  return (
    <NodeShell
      accent={isUser ? "var(--user)" : "var(--accent)"}
      borderColor="var(--border)"
      glowColor={isUser ? "var(--glow-user)" : "var(--glow-pending)"}
    >
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] tabular-nums text-[var(--ink-muted)]">
          {isUser ? "you" : "claude"} / {fmtTime(data.timestamp)}
        </div>
        <div className="truncate text-[11px] leading-tight">{truncate(data.label, 60) || "..."}</div>
      </div>
    </NodeShell>
  );
}

export function ToolNode({ data }: NodeProps & { data: ToolNodeData }) {
  return (
    <NodeShell
      accent={colorForLabel(data.name)}
      borderColor={STATUS_BORDER[data.status]}
      glowColor={STATUS_GLOW[data.status]}
      pulsing={data.status === "pending"}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono text-[11px] font-semibold">{data.name}</span>
          {data.status === "pending" ? (
            <span className="font-mono text-[10px] text-[var(--ink-muted)]">RUN</span>
          ) : data.status === "error" ? (
            <span className="font-mono text-[10px]" style={{ color: "var(--error)" }}>
              ERR
            </span>
          ) : (
            <span className="font-mono text-[10px]" style={{ color: "var(--success)" }}>
              OK
            </span>
          )}
        </div>
        <div className="font-mono text-[10px] tabular-nums text-[var(--ink-muted)]">{data.duration || "..."}</div>
      </div>
    </NodeShell>
  );
}

export function AgentNode({ data }: NodeProps & { data: ToolNodeData }) {
  const identity = colorForLabel(data.label);
  return (
    <NodeShell
      accent={identity}
      borderColor={data.status === "pending" || data.status === "error" ? STATUS_BORDER[data.status] : identity}
      glowColor={data.status === "pending" ? "var(--glow-agent)" : data.status === "error" ? STATUS_GLOW[data.status] : `${identity}88`}
      pulsing={data.status === "pending"}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono text-[11px] font-semibold" style={{ color: identity }}>
            {truncate(data.label, 16)}
          </span>
          {data.status === "pending" ? (
            <span className="font-mono text-[10px] text-[var(--ink-muted)]">RUN</span>
          ) : data.status === "error" ? (
            <span className="font-mono text-[10px]" style={{ color: "var(--error)" }}>
              ERR
            </span>
          ) : (
            <span className="font-mono text-[10px]" style={{ color: "var(--success)" }}>
              OK
            </span>
          )}
        </div>
        <div className="font-mono text-[10px] tabular-nums text-[var(--ink-muted)]">agent / {data.duration || "..."}</div>
      </div>
    </NodeShell>
  );
}



