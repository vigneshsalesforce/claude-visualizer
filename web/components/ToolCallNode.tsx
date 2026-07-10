"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ProcessedTranscript, ToolCallEntry } from "@/lib/transcript-parser";
import { extractText, flattenTurns } from "@/lib/transcript-parser";
import { fmtDuration, fmtTime, keyParamSummary, truncate } from "@/lib/format";
import { colorForLabel } from "@/lib/categorical-colors";
import { ConvoNode } from "./ConvoNode";

interface ToolCallNodeProps {
  toolCall: ToolCallEntry;
  depth: number;
  subagentProcessed: Map<string, ProcessedTranscript>;
  showSystem: boolean;
  filterText: string;
  expandSignal: number;
  collapseSignal: number;
}

function StatusChip({ toolCall }: { toolCall: ToolCallEntry }) {
  if (!toolCall.result) {
    return (
      <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-[var(--ink-muted)] whitespace-nowrap">
        RUN live
      </span>
    );
  }
  if (toolCall.result.isError) {
    return (
      <motion.span
        initial={{ scale: 0.85 }}
        animate={{ scale: 1 }}
        className="rounded-full border px-1.5 py-0.5 font-mono text-[11px] tabular-nums whitespace-nowrap"
        style={{ color: "var(--error)", borderColor: "color-mix(in srgb, var(--error) 45%, var(--border))" }}
      >
        ERR {fmtDuration(toolCall.durationMs)}
      </motion.span>
    );
  }
  return (
    <motion.span
      initial={{ scale: 0.85 }}
      animate={{ scale: 1 }}
      className="rounded-full border px-1.5 py-0.5 font-mono text-[11px] tabular-nums whitespace-nowrap"
      style={{ color: "var(--success)", borderColor: "color-mix(in srgb, var(--success) 45%, var(--border))" }}
    >
      OK {fmtDuration(toolCall.durationMs)}
    </motion.span>
  );
}

function ResultDetail({ toolCall }: { toolCall: ToolCallEntry }) {
  const tur = toolCall.result?.toolUseResult;
  return (
    <>
      {toolCall.result ? (
        tur && (tur.stdout != null || tur.stderr != null) ? (
          <>
            {!!tur.stdout && (
              <>
                <div className="mt-2 font-mono text-[11px] tracking-wide text-[var(--ink-muted)] uppercase first:mt-0">
                  stdout
                </div>
                <pre className="max-h-80 overflow-auto font-mono text-[12px] whitespace-pre-wrap">{tur.stdout}</pre>
              </>
            )}
            {!!tur.stderr && (
              <>
                <div className="mt-2 font-mono text-[11px] tracking-wide text-[var(--ink-muted)] uppercase">
                  stderr
                </div>
                <pre className="max-h-80 overflow-auto font-mono text-[12px] whitespace-pre-wrap">{tur.stderr}</pre>
              </>
            )}
          </>
        ) : (
          <>
            <div className="font-mono text-[11px] tracking-wide text-[var(--ink-muted)] uppercase">result</div>
            <pre className="max-h-80 overflow-auto font-mono text-[12px] whitespace-pre-wrap">
              {truncate(extractText(toolCall.result.content), 4000)}
            </pre>
          </>
        )
      ) : (
        <>
          <div className="font-mono text-[11px] tracking-wide text-[var(--ink-muted)] uppercase">result</div>
          <pre className="font-mono text-[12px]">(no result yet - call is in flight)</pre>
        </>
      )}
      <div className="mt-2 font-mono text-[11px] tracking-wide text-[var(--ink-muted)] uppercase">input</div>
      <pre className="max-h-80 overflow-auto font-mono text-[12px] whitespace-pre-wrap">
        {JSON.stringify(toolCall.input, null, 2)}
      </pre>
    </>
  );
}

function AgentSummary({ toolCall }: { toolCall: ToolCallEntry }) {
  if (!toolCall.agentSummary) return null;
  const s = toolCall.agentSummary;
  const stats = s.toolStats || {};
  return (
    <div className="mb-2 flex flex-wrap gap-3 font-mono text-[11px] tabular-nums text-[var(--ink-muted)]">
      {s.totalDurationMs != null && (
        <span>
          <b className="font-semibold text-[var(--ink)]">{fmtDuration(s.totalDurationMs)}</b> runtime
        </span>
      )}
      {s.totalTokens != null && (
        <span>
          <b className="font-semibold text-[var(--ink)]">{s.totalTokens.toLocaleString()}</b> tokens
        </span>
      )}
      {s.totalToolUseCount != null && (
        <span>
          <b className="font-semibold text-[var(--ink)]">{s.totalToolUseCount}</b> tool calls
        </span>
      )}
      {Object.entries(stats).map(
        ([k, v]) =>
          !!v && (
            <span key={k}>
              <b className="font-semibold text-[var(--ink)]">{v}</b> {k.replace(/Count$/, "")}
            </span>
          )
      )}
    </div>
  );
}

export function ToolCallNode({
  toolCall,
  depth,
  subagentProcessed,
  showSystem,
  filterText,
  expandSignal,
  collapseSignal,
}: ToolCallNodeProps) {
  const isSubagent = toolCall.isAgent;
  const [open, setOpen] = useState(!toolCall.result);
  const lastExpandToken = useRef(expandSignal);
  const lastCollapseToken = useRef(collapseSignal);

  useEffect(() => {
    if (expandSignal !== lastExpandToken.current) {
      lastExpandToken.current = expandSignal;
      setOpen(true);
    }
  }, [expandSignal]);
  useEffect(() => {
    if (collapseSignal !== lastCollapseToken.current) {
      lastCollapseToken.current = collapseSignal;
      setOpen(false);
    }
  }, [collapseSignal]);

  const filterHay = (toolCall.name + " " + JSON.stringify(toolCall.input || {})).toLowerCase();
  const matches = !filterText || filterHay.includes(filterText);

  const childTranscript = isSubagent && toolCall.agentId ? subagentProcessed.get(toolCall.agentId) : null;
  const agentColor = isSubagent ? colorForLabel(String(toolCall.input?.subagent_type ?? toolCall.name)) : null;

  return (
    <div className={matches ? "" : "hidden"}>
      <div className="my-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-baseline gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        >
          <span
            className="flex h-5 w-5 flex-none items-center justify-center rounded font-mono text-[11px] font-bold text-white"
            style={{ background: agentColor ?? "var(--surface-2)" }}
          >
            <span className={isSubagent ? "" : "text-[var(--ink-muted)]"}>{isSubagent ? "A" : ">"}</span>
          </span>
          <span className="flex-none font-mono text-xs tabular-nums text-[var(--ink-muted)]">
            {fmtTime(toolCall.callTimestamp)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px]">
            <span className="mr-1.5 font-mono font-semibold">{toolCall.name}</span>
            {keyParamSummary(toolCall)}
          </span>
          <StatusChip toolCall={toolCall} />
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="detail"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="ml-[2.6rem] overflow-hidden"
            >
              <div className="my-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                {isSubagent ? (
                  childTranscript ? (
                    <>
                      <AgentSummary toolCall={toolCall} />
                      {!toolCall.agentSummary && (
                        <div className="mb-2 font-mono text-[11px] text-[var(--ink-muted)]">
                          subagent running/finished - live-tailing its own file (
                          {childTranscript.meta.lineCount} lines so far)
                        </div>
                      )}
                      <div className="ml-[1.15rem] border-l-[1.5px] border-[var(--border)] pl-3.5">
                        {flattenTurns(childTranscript.roots).map((turn, i) => (
                          <ConvoNode
                            key={turn.uuid ?? i}
                            record={turn}
                            depth={depth + 1}
                            toolCallIndex={childTranscript.toolCalls}
                            subagentProcessed={subagentProcessed}
                            showSystem={showSystem}
                            filterText={filterText}
                            expandSignal={expandSignal}
                            collapseSignal={collapseSignal}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <AgentSummary toolCall={toolCall} />
                      <div className="mb-2 rounded-md border border-dashed border-[var(--border)] px-2.5 py-1.5 text-[12px] text-[var(--ink-muted)]">
                        {toolCall.agentId
                          ? `waiting for subagent file agent-${toolCall.agentId}.jsonl to appear on disk...`
                          : "this dispatch errored before an agent id was assigned - see result below"}
                      </div>
                      <ResultDetail toolCall={toolCall} />
                    </>
                  )
                ) : (
                  <ResultDetail toolCall={toolCall} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}



