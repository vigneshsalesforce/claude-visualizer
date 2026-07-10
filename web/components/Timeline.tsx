"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { flattenTurns, type ProcessedTranscript } from "@/lib/transcript-parser";
import { ConvoNode } from "./ConvoNode";

interface TimelineProps {
  processed: ProcessedTranscript | null;
  subagentProcessed: Map<string, ProcessedTranscript>;
  showSystem: boolean;
  filterText: string;
  expandSignal: number;
  collapseSignal: number;
}

export function Timeline({
  processed,
  subagentProcessed,
  showSystem,
  filterText,
  expandSignal,
  collapseSignal,
}: TimelineProps) {
  // Turns are one long parent -> child chain; flattened once here into a
  // plain list so React never has to recurse component-within-component
  // per turn (see flattenTurns' doc comment for why that blew the stack).
  const turns = useMemo(() => (processed ? flattenTurns(processed.roots) : []), [processed]);

  if (!processed) {
    return <div className="mt-4 font-mono text-[13px] text-[var(--ink-muted)]">waiting for events...</div>;
  }

  return (
    <div className="mt-2">
      <AnimatePresence initial={false}>
        {turns.map((turn, i) => (
          <motion.div key={turn.uuid ?? i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <ConvoNode
              record={turn}
              depth={0}
              toolCallIndex={processed.toolCalls}
              subagentProcessed={subagentProcessed}
              showSystem={showSystem}
              filterText={filterText}
              expandSignal={expandSignal}
              collapseSignal={collapseSignal}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}



