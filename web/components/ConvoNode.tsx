"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ProcessedTranscript, TranscriptRecord } from "@/lib/transcript-parser";
import { extractText, isToolResultMessage } from "@/lib/transcript-parser";
import { fmtTime, truncate } from "@/lib/format";
import { ToolCallNode } from "./ToolCallNode";

interface ConvoNodeProps {
  record: TranscriptRecord;
  depth: number;
  toolCallIndex: ProcessedTranscript["toolCalls"];
  subagentProcessed: Map<string, ProcessedTranscript>;
  showSystem: boolean;
  filterText: string;
  expandSignal: number;
  collapseSignal: number;
}

function Row({
  glyph,
  glyphStyle,
  time,
  text,
  filterText,
  filterHay,
}: {
  glyph: string;
  glyphStyle: React.CSSProperties;
  time?: string;
  text: string;
  filterText: string;
  filterHay: string;
}) {
  const matches = !filterText || filterHay.toLowerCase().includes(filterText);
  return (
    <div className={matches ? "my-1 flex items-baseline gap-2 rounded-md px-1.5 py-1.5" : "hidden"}>
      <span
        className="flex h-5 w-5 flex-none items-center justify-center rounded font-mono text-[11px] font-bold text-white"
        style={glyphStyle}
      >
        {glyph}
      </span>
      {time && <span className="flex-none font-mono text-xs tabular-nums text-[var(--ink-muted)]">{time}</span>}
      <span className="min-w-0 flex-1 truncate text-[13px]">{text}</span>
    </div>
  );
}

function ThinkingRow({
  time,
  thinking,
  filterText,
  expandSignal,
  collapseSignal,
}: {
  time?: string;
  thinking: string;
  filterText: string;
  expandSignal: number;
  collapseSignal: number;
}) {
  const [open, setOpen] = useState(false);
  const matches = !filterText || thinking.toLowerCase().includes(filterText);
  // reacts the same way ToolCallNode's expand/collapse-all does, but
  // thinking blocks default closed regardless, so only wire collapse (a
  // no-op) and expand signals via simple prop-change detection is overkill
  // here - thinking blocks are secondary detail, left to per-row toggling.
  void expandSignal;
  void collapseSignal;
  if (!matches) return null;
  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-baseline gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-[var(--surface-2)]"
      >
        <span className="flex h-5 w-5 flex-none items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)] font-mono text-[11px] text-[var(--ink-muted)]">
          ...
        </span>
        {time && <span className="flex-none font-mono text-xs tabular-nums text-[var(--ink-muted)]">{time}</span>}
        <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink-muted)] italic">
          (thinking, {thinking.split(/\s+/).length} words)
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="ml-[2.6rem] overflow-hidden"
          >
            <div className="my-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] whitespace-pre-wrap">
              {thinking}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ConvoNode({
  record,
  depth,
  toolCallIndex,
  subagentProcessed,
  showSystem,
  filterText,
  expandSignal,
  collapseSignal,
}: ConvoNodeProps) {
  let body: React.ReactNode = null;

  if (record.type === "attachment") {
    if (showSystem) {
      const kind =
        (record.content && typeof record.content === "object" && "kind" in record.content
          ? String((record.content as { kind: unknown }).kind)
          : "system update") || "system update";
      body = (
        <Row
          glyph="/"
          glyphStyle={{ background: "var(--surface-2)", color: "var(--ink-muted)" }}
          time={fmtTime(record.timestamp)}
          text={`system: ${kind}`}
          filterText={filterText}
          filterHay={`system attachment ${kind}`}
        />
      );
    }
  } else if (record.type === "user" && !isToolResultMessage(record)) {
    const text = extractText(record.message?.content);
    body = (
      <Row
        glyph="U"
        glyphStyle={{ background: "var(--user)" }}
        time={fmtTime(record.timestamp)}
        text={truncate(text, 140)}
        filterText={filterText}
        filterHay={text}
      />
    );
  } else if (record.type === "assistant") {
    const blocks = record.message?.content;
    const arr = Array.isArray(blocks) ? blocks : [];
    const textBlocks = arr.filter((b) => b && typeof b === "object" && "type" in b && b.type === "text");
    const thinkingBlocks = arr.filter((b) => b && typeof b === "object" && "type" in b && b.type === "thinking");
    const toolBlocks = arr.filter((b) => b && typeof b === "object" && "type" in b && b.type === "tool_use");

    const atext = textBlocks.map((b) => (b as { text: string }).text).join("\n");
    const athink = thinkingBlocks.map((b) => (b as { thinking: string }).thinking).join("\n");

    body = (
      <>
        {atext && (
          <Row
            glyph="A"
            glyphStyle={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            time={fmtTime(record.timestamp)}
            text={truncate(atext, 140)}
            filterText={filterText}
            filterHay={atext}
          />
        )}
        {!atext && athink && (
          <ThinkingRow
            time={fmtTime(record.timestamp)}
            thinking={athink}
            filterText={filterText}
            expandSignal={expandSignal}
            collapseSignal={collapseSignal}
          />
        )}
        {toolBlocks.length > 0 && (
          <div className="ml-[1.15rem] border-l-[1.5px] border-[var(--border)] pl-3.5">
            <AnimatePresence initial={false}>
              {toolBlocks.map((b) => {
                const block = b as { id: string };
                const tc = toolCallIndex.get(block.id);
                if (!tc) return null;
                return (
                  <motion.div
                    key={block.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <ToolCallNode
                      toolCall={tc}
                      depth={depth + 1}
                      subagentProcessed={subagentProcessed}
                      showSystem={showSystem}
                      filterText={filterText}
                      expandSignal={expandSignal}
                      collapseSignal={collapseSignal}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </>
    );
  }

  return <div>{body}</div>;
}



