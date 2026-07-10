"use client";

import { motion } from "motion/react";
import { StatusDot, type ConnectionStatus } from "./StatusDot";

export type ViewMode = "timeline" | "graph" | "canvas" | "tree";
export type Theme = "dark" | "light";

interface ToolbarProps {
  status: ConnectionStatus;
  statsText: string;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  filterText: string;
  onFilterChange: (value: string) => void;
  showSystem: boolean;
  onShowSystemChange: (value: boolean) => void;
  autoScroll: boolean;
  onAutoScrollChange: (value: boolean) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const VIEW_LABELS: Record<ViewMode, string> = {
  canvas: "Canvas",
  graph: "Graph",
  tree: "Tree",
  timeline: "Log",
};

function ToolbarButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className="focus-ring rounded-md border border-[var(--glass-border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-3)]"
    >
      {children}
    </motion.button>
  );
}

function ViewToggle({ view, onViewChange }: { view: ViewMode; onViewChange: (view: ViewMode) => void }) {
  return (
    <div
      className="relative flex items-center gap-1 rounded px-1 py-0.5 font-mono text-[11px]"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      {(["canvas", "tree", "timeline"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onViewChange(mode)}
          className="focus-ring relative z-10 rounded px-2 py-1 transition-colors"
          style={{ color: view === mode ? "var(--ink)" : "var(--ink-muted)" }}
        >
          {mode === view && (
            <motion.span
              layoutId="view-toggle-pill"
              className="absolute inset-0 -z-10 rounded"
              style={{
                background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
              }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          {VIEW_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}

function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  const isLight = theme === "light";
  return (
    <button
      type="button"
      onClick={() => onChange(isLight ? "dark" : "light")}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      aria-pressed={isLight}
      className="focus-ring rounded-md border border-[var(--glass-border)] bg-[var(--surface-2)] px-2 py-1.5 text-[13px] leading-none transition hover:border-[var(--accent)] hover:bg-[var(--surface-3)]"
    >
      {isLight ? "☀️" : "🌙"}
    </button>
  );
}

function ToggleField({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)] flex items-center gap-2 rounded-md px-1.5 py-1 text-[12px] font-medium text-[var(--ink-muted)]">
      <input className="h-3.5 w-3.5 accent-[var(--accent)]" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Toolbar({
  status,
  statsText,
  view,
  onViewChange,
  filterText,
  onFilterChange,
  showSystem,
  onShowSystemChange,
  autoScroll,
  onAutoScrollChange,
  onExpandAll,
  onCollapseAll,
  theme,
  onThemeChange,
}: ToolbarProps) {
  return (
    <header
      className="sticky top-0 z-50 px-4 py-3 backdrop-blur-xl"
      style={{ background: "var(--panel-bg)", borderBottom: "1px solid var(--glass-border)" }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-1 min-w-[190px]">
          <h1 className="gradient-text font-mono text-[15px] font-bold leading-tight tracking-wide">AGENT VISUALIZER</h1>
        </div>
        <StatusDot status={status} />
        <ViewToggle view={view} onViewChange={onViewChange} />

        {view === "timeline" && (
          <div className="flex flex-wrap items-center gap-2">
            <ToolbarButton onClick={onExpandAll}>Expand</ToolbarButton>
            <ToolbarButton onClick={onCollapseAll}>Collapse</ToolbarButton>
            <input
              type="text"
              value={filterText}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder="Filter tools or text"
              className="focus-ring min-w-52 rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
            />
            <ToggleField checked={showSystem} onChange={onShowSystemChange} label="System" />
            <ToggleField checked={autoScroll} onChange={onAutoScrollChange} label="Auto-scroll" />
          </div>
        )}

        <span className="ml-auto font-mono text-[10px] tabular-nums whitespace-nowrap text-[var(--ink-muted)]">{statsText}</span>
        <ThemeToggle theme={theme} onChange={onThemeChange} />
      </div>
    </header>
  );
}



