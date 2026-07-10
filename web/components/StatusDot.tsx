"use client";

import { motion } from "motion/react";

export type ConnectionStatus = "connecting" | "live" | "down";

const LABEL: Record<ConnectionStatus, string> = {
  connecting: "CONNECTING",
  live: "LIVE",
  down: "OFFLINE",
};

const COLOR: Record<ConnectionStatus, string> = {
  connecting: "var(--ink-muted)",
  live: "#ff4444",
  down: "#ff5566",
};

const TEXT_COLOR: Record<ConnectionStatus, string> = {
  connecting: "var(--ink-muted)",
  live: "#ff6666",
  down: "#ff5566",
};

export function StatusDot({ status }: { status: ConnectionStatus }) {
  return (
    <span
      className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider whitespace-nowrap"
      style={{ color: TEXT_COLOR[status] }}
    >
      <span className="relative inline-flex h-2 w-2">
        {status === "live" && (
          <motion.span
            className="absolute inline-flex h-full w-full rounded-full"
            style={{ background: COLOR.live, boxShadow: `0 0 8px ${COLOR.live}` }}
            animate={{ opacity: [0.55, 0, 0.55], scale: [1, 2.1, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <span
          className="relative inline-flex h-2 w-2 rounded-full transition-colors duration-300"
          style={{ background: COLOR[status], boxShadow: status === "live" ? `0 0 6px ${COLOR.live}` : undefined }}
        />
      </span>
      {LABEL[status]}
    </span>
  );
}



