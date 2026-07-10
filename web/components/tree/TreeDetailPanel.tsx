"use client";

import { AnimatePresence, motion } from "motion/react";
import type { TreeNode } from "@/lib/tree-scene";

const BADGE_COLOR: Record<TreeNode["badge"], string> = {
  Agent: "var(--subagent)",
  MCP: "var(--user)",
  Skill: "var(--accent-2)",
  Tool: "var(--ink-muted)",
};

const BADGE_ICON: Record<TreeNode["badge"], string> = {
  Agent: "\u{1F916}",
  MCP: "\u{1F50C}",
  Skill: "\u{1F9E9}",
  Tool: "\u{1F527}",
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[12px] text-[var(--ink)]">{children}</span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <div className="mb-0.5 text-[11px] font-semibold tracking-wide text-[var(--ink-muted)] uppercase">{label}</div>
      <div className="text-[13px] text-[var(--ink)]">{value}</div>
    </div>
  );
}

export function TreeDetailPanel({
  node,
  onClose,
  onSelectId,
}: {
  node: TreeNode | null;
  onClose: () => void;
  onSelectId: (id: string) => void;
}) {
  const linkedAgents = node?.children.filter((c) => c.badge === "Agent") ?? [];
  const skills = node?.children.filter((c) => c.badge === "Skill").map((c) => c.name) ?? [];

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: -360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -360, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="absolute top-0 left-0 z-20 h-full w-[340px] max-w-[90vw] overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
        >
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[20px]"
                style={{ background: `color-mix(in srgb, ${BADGE_COLOR[node.badge]} 20%, var(--surface))` }}
              >
                {BADGE_ICON[node.badge]}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-[var(--ink)]">{node.name}</div>
                <div className="text-[12px] text-[var(--ink-muted)]">
                  {node.badge} / used {node.callCount === 1 ? "once" : `${node.callCount} times`}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-none rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--ink-muted)] hover:border-[var(--accent)]"
            >
              Close
            </button>
          </div>

          <Field label="Description" value={node.description} />
          <Field label="Provider" value="Anthropic" />
          <Field label="Platform" value={node.platform} />
          {node.badge === "Agent" && <Field label="LLM" value="Claude" />}

          {skills.length > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--ink-muted)] uppercase">Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
            </div>
          )}

          {linkedAgents.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--ink-muted)] uppercase">
                Linked Agents
              </div>
              <div className="flex flex-col gap-1">
                {linkedAgents.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSelectId(a.id)}
                    className="flex items-center gap-1.5 text-left text-[13px] text-[var(--subagent)] hover:underline"
                  >
                    <span>{BADGE_ICON.Agent}</span>
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}



