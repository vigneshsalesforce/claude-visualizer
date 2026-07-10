"use client";

import { useEffect, useRef, useState } from "react";
import { processTranscript, type ProcessedTranscript } from "@/lib/transcript-parser";
import type { ConnectionStatus } from "@/components/StatusDot";
import { Toolbar, type ViewMode, type Theme } from "@/components/Toolbar";
import { Timeline } from "@/components/Timeline";
import { GraphView } from "@/components/graph/GraphView";
import { CanvasView } from "@/components/canvas/CanvasView";
import { TreeView } from "@/components/tree/TreeView";
import { SessionTabs } from "@/components/SessionTabs";

interface Envelope {
  source: "main" | "subagent" | "subagent-added" | "session-added" | "session-removed";
  sessionId: string;
  agentId: string | null;
  raw?: string;
  path?: string;
}

interface SessionData {
  path: string;
  mainProcessed: ProcessedTranscript | null;
  subagentProcessed: Map<string, ProcessedTranscript>;
}

const EMPTY_SUBAGENTS = new Map<string, ProcessedTranscript>();

export default function Home() {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [view, setView] = useState<ViewMode>("canvas");
  const [sessions, setSessions] = useState<Map<string, SessionData>>(new Map());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSystem, setShowSystem] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandSignal, setExpandSignal] = useState(0);
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [theme, setTheme] = useState<Theme>("dark");

  // Session tab selection follows whichever session is currently active
  // (most recently discovered / receiving messages) until the user manually
  // picks a tab - after that we stop auto-following so we don't yank the
  // view out from under them.
  const userSelectedSessionRef = useRef(false);
  const handleSelectSession = (id: string) => {
    userSelectedSessionRef.current = true;
    setActiveSessionId(id);
  };

  useEffect(() => {
    const stored = window.localStorage.getItem("agent-visualizer-theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("agent-visualizer-theme", theme);
  }, [theme]);

  // Same rationale as the original single-session version: reprocessing a
  // transcript re-parses every line seen so far, so doing it once per SSE
  // message is O(n^2) over a session. onmessage only accumulates raw text
  // and marks what's dirty (per session, per subagent); the actual
  // processTranscript() calls happen at most once per animation frame.
  const sessionTextRef = useRef(new Map<string, string>());
  const subagentTextRef = useRef(new Map<string, Map<string, string>>());
  const dirtyMainRef = useRef(new Set<string>());
  const dirtySubagentsRef = useRef(new Map<string, Set<string>>());
  const sessionPathsRef = useRef(new Map<string, string>());
  const renderScheduledRef = useRef(false);

  const scheduleRender = () => {
    if (renderScheduledRef.current) return;
    renderScheduledRef.current = true;
    requestAnimationFrame(() => {
      renderScheduledRef.current = false;
      const dirtyMain = dirtyMainRef.current;
      const dirtySub = dirtySubagentsRef.current;
      if (dirtyMain.size === 0 && dirtySub.size === 0) return;

      setSessions((prev) => {
        const next = new Map(prev);

        for (const sessionId of dirtyMain) {
          const existing = next.get(sessionId);
          next.set(sessionId, {
            path: existing?.path ?? sessionPathsRef.current.get(sessionId) ?? "",
            mainProcessed: processTranscript(sessionTextRef.current.get(sessionId) ?? ""),
            subagentProcessed: existing?.subagentProcessed ?? new Map(),
          });
        }

        for (const [sessionId, agentIds] of dirtySub) {
          const existing = next.get(sessionId);
          if (!existing) continue;
          const nextSubagentProcessed = new Map(existing.subagentProcessed);
          const texts = subagentTextRef.current.get(sessionId);
          for (const agentId of agentIds) {
            nextSubagentProcessed.set(agentId, processTranscript(texts?.get(agentId) ?? ""));
          }
          next.set(sessionId, { ...existing, subagentProcessed: nextSubagentProcessed });
        }

        return next;
      });

      dirtyMain.clear();
      dirtySub.clear();
    });
  };

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onopen = () => setStatus("live");
    es.onerror = () => setStatus("down");
    es.onmessage = (evt) => {
      const envelope: Envelope = JSON.parse(evt.data);
      const { sessionId } = envelope;

      if (envelope.source === "session-added") {
        sessionPathsRef.current.set(sessionId, envelope.path ?? "");
        if (!sessionTextRef.current.has(sessionId)) sessionTextRef.current.set(sessionId, "");
        if (!subagentTextRef.current.has(sessionId)) subagentTextRef.current.set(sessionId, new Map());
        setSessions((prev) => {
          if (prev.has(sessionId)) return prev;
          const next = new Map(prev);
          next.set(sessionId, { path: envelope.path ?? "", mainProcessed: null, subagentProcessed: new Map() });
          return next;
        });
        if (!userSelectedSessionRef.current) setActiveSessionId(sessionId);
        return;
      }

      if (envelope.source === "session-removed") {
        sessionTextRef.current.delete(sessionId);
        subagentTextRef.current.delete(sessionId);
        dirtyMainRef.current.delete(sessionId);
        dirtySubagentsRef.current.delete(sessionId);
        sessionPathsRef.current.delete(sessionId);
        setSessions((prev) => {
          if (!prev.has(sessionId)) return prev;
          const next = new Map(prev);
          next.delete(sessionId);
          return next;
        });
        setActiveSessionId((prev) => {
          if (prev !== sessionId) return prev;
          userSelectedSessionRef.current = false;
          return null;
        });
        return;
      }

      if (envelope.source === "main") {
        sessionTextRef.current.set(sessionId, (sessionTextRef.current.get(sessionId) ?? "") + envelope.raw + "\n");
        dirtyMainRef.current.add(sessionId);
        scheduleRender();
        // Follow whichever session is actively producing messages until the
        // user manually picks a tab - a freshly (re)started dev server would
        // otherwise stay pinned on whatever session happened to be newest
        // when it booted, even after a different one becomes current.
        if (!userSelectedSessionRef.current) {
          setActiveSessionId((prev) => (prev === sessionId ? prev : sessionId));
        }
      } else if (envelope.source === "subagent" && envelope.agentId) {
        const agentId = envelope.agentId;
        const texts = subagentTextRef.current.get(sessionId) ?? new Map<string, string>();
        texts.set(agentId, (texts.get(agentId) ?? "") + envelope.raw + "\n");
        subagentTextRef.current.set(sessionId, texts);

        const dirtySet = dirtySubagentsRef.current.get(sessionId) ?? new Set<string>();
        dirtySet.add(agentId);
        dirtySubagentsRef.current.set(sessionId, dirtySet);
        scheduleRender();
      } else if (envelope.source === "subagent-added" && envelope.agentId) {
        const texts = subagentTextRef.current.get(sessionId) ?? new Map<string, string>();
        if (!texts.has(envelope.agentId)) texts.set(envelope.agentId, "");
        subagentTextRef.current.set(sessionId, texts);
      }
    };
    return () => es.close();
  }, []);

  const activeSession = activeSessionId ? (sessions.get(activeSessionId) ?? null) : null;
  const mainProcessed = activeSession?.mainProcessed ?? null;
  const subagentProcessed = activeSession?.subagentProcessed ?? EMPTY_SUBAGENTS;

  useEffect(() => {
    if (view === "timeline" && autoScroll && mainProcessed) {
      window.scrollTo({ top: document.body.scrollHeight });
    }
  }, [mainProcessed, autoScroll, view]);

  const stats = mainProcessed
    ? (() => {
        let agentCount = 1;
        let totalErrors = 0;
        mainProcessed.toolCalls.forEach((tc) => {
          if (tc.isAgent) agentCount++;
          if (tc.result?.isError) totalErrors++;
        });
        const tokens = mainProcessed.meta.totalOutputTokens;
        const tokensLabel = tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : `${tokens}`;
        return `${agentCount} agents · ${tokensLabel} tokens${totalErrors > 0 ? ` · ${totalErrors} errors` : ""}`;
      })()
    : "waiting...";

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <Toolbar
        status={status}
        statsText={stats}
        view={view}
        onViewChange={setView}
        filterText={filterText}
        onFilterChange={setFilterText}
        showSystem={showSystem}
        onShowSystemChange={setShowSystem}
        autoScroll={autoScroll}
        onAutoScrollChange={setAutoScroll}
        onExpandAll={() => setExpandSignal((n) => n + 1)}
        onCollapseAll={() => setCollapseSignal((n) => n + 1)}
        theme={theme}
        onThemeChange={setTheme}
      />
      <SessionTabs sessions={sessions} activeSessionId={activeSessionId} onSelect={handleSelectSession} />
      {activeSessionId && (
        <div className="mx-4 mt-2 truncate font-mono text-[10px] text-[var(--ink-muted)]" title={activeSession?.path}>
          tracking session {activeSessionId}
        </div>
      )}
      {view === "timeline" ? (
        <div className="flex flex-1 justify-center px-4 py-4 pb-16">
          <div className="w-full max-w-4xl">
            <Timeline
              processed={mainProcessed}
              subagentProcessed={subagentProcessed}
              showSystem={showSystem}
              filterText={filterText.trim().toLowerCase()}
              expandSignal={expandSignal}
              collapseSignal={collapseSignal}
            />
          </div>
        </div>
      ) : view === "graph" ? (
        <div className="flex-1 px-4 py-4">
          <GraphView processed={mainProcessed} subagentProcessed={subagentProcessed} />
        </div>
      ) : view === "canvas" ? (
        <div className="flex-1 px-4 py-4">
          <CanvasView processed={mainProcessed} subagentProcessed={subagentProcessed} />
        </div>
      ) : (
        <div className="flex-1 px-4 py-4">
          <TreeView processed={mainProcessed} subagentProcessed={subagentProcessed} />
        </div>
      )}
    </div>
  );
}





