# Claude Code Visualizer

A homemade alternative to [Agent Flow](https://github.com/patoles/agent-flow)
(see `../SETUP.md` for why we didn't just use that directly). Claude Code
already writes a complete transcript of every session to disk as JSONL — no
custom hook required — so both tools here just read that file.

## Install via npm

```bash
npm install -g claude-code-visualizer
claude-visualizer  # Auto-detect and visualize your latest session
```

See [NPM_README.md](./NPM_README.md) for full installation and usage instructions.

## `replay.html` — static replay, works today

Open it in a browser (or use the published Artifact link), then drop in one
or more `.jsonl` transcript files:

- `~/.claude/projects/<sanitized-cwd>/<session-id>.jsonl` — a main session
- `~/.claude/projects/<sanitized-cwd>/<session-id>/subagents/agent-<id>.jsonl` — a subagent run

You get an interactive timeline: user/assistant turns, tool calls (name, key
params, duration, success/error), and any `Agent` dispatch expands into the
matching subagent's own nested timeline if you also load its file (matched
by the `agentId` embedded in the filename).

Runs entirely client-side — nothing you load ever leaves the page. No
install required, which is the whole point of keeping it around alongside
the richer app below.

Known limits:
- A dispatched-in-the-background subagent (`run_in_background: true`) never
  gets its completion stats (duration/tokens) recorded in the *main*
  transcript — only in the subagent's own file. The viewer says so
  explicitly rather than showing a stale "still running."
- No auto-discovery of sibling files — the page has no filesystem access,
  so you load each file yourself.

`shared_render.js` is the reference implementation its parsing logic is
based on (also handy for quick Node-based checks against a transcript) —
`web/lib/transcript-parser.ts` is a verified TypeScript port of the same
logic, not a live import of this file.

## `web/` — live view, Next.js + Tailwind + Motion

The animated, live-tailing app. Replaces the earlier `tail_server.py` +
`viewer.html` prototype (Python backend, vanilla JS/CSS frontend) with a
single Next.js app: a TypeScript port of the same tailing logic runs as an
API route (`app/api/events/route.ts`, Server-Sent Events, stdlib `fs`
polling — no Claude Code hooks or settings touched, same as before), and the
frontend is componentized with Framer Motion for the live-updating timeline,
expand/collapse, and status indicator.

```
cd visualizer/web
npm install
npm run dev            # auto-detects the current session from cwd
# or:
TRANSCRIPT_PATH=/path/to/session.jsonl npm run dev -- --port 3100
```

Then open `http://localhost:3000` (or whatever port you passed). It streams
the full backlog first, then stays live — new turns, tool calls, and
subagent dispatches appear as they're written, no refresh needed.

Two views, switchable from the toolbar:
- **Timeline** — the original vertical list: expand/collapse, filter,
  auto-scroll.
- **Graph** — an Agent-Flow-style node canvas (`@xyflow/react`): one node
  per turn and per tool call, connected left-to-right in sequence, with
  each subagent dispatch branching downward into its own connected
  sub-chain. Pan/zoom/minimap, animated flowing edges, nodes scale/fade in
  as they arrive live, click any node for a detail side-panel (input/result,
  or full turn text). Violet-bordered nodes are subagent dispatches;
  duration chips are green/red/hourglass for done/errored/in-flight.

**Verified live, against this repo's own (very long) session**, while it was
being built:
- Made a new tool call and watched it appear in an already-open page within
  seconds, no reload — same test as the Python prototype, same result, run
  again after adding the graph view.
- Along the way, hit and fixed a real bug: this session's conversation is a
  300+ turn linear chain, and rendering it by recursing one React component
  into the next per turn (cheap in the old vanilla-DOM version) blew the
  call stack once the tree got deep enough with Framer Motion's
  `AnimatePresence` wrapping each level. Fixed by flattening the turn chain
  into a plain array before rendering (`flattenTurns` in
  `lib/transcript-parser.ts`) — turns were never visually indented for
  chaining anyway, only tool calls and subagent nesting are, so nothing
  about the rendered output changed, just how it gets there.
- Confirmed the graph view against the same live session: node/edge counts
  match the known data (7 subagent-dispatch nodes = the 7 subagents this
  session actually ran), 100% of edges render with the flowing-dash
  animation, and click-to-inspect opens the correct detail panel.
- On a 300+ turn session the graph is wide (one row per turn/tool call);
  `fitView`'s default `minZoom` keeps individual nodes legible rather than
  shrinking everything to fit on screen at once, so panning + the minimap
  is the intended way to navigate history, not an all-at-once overview.

Known limits (real, not hedging):
- **Auto-detect uses the directory you run it from**, not the directory
  your Claude Code session started in. If they differ, set `TRANSCRIPT_PATH`
  explicitly — auto-detect looks in
  `~/.claude/projects/<cwd-with-slashes-as-dashes>/`.
- **Rendering reprocesses the whole accumulated transcript on every
  animation frame that has new lines**, not just the new lines (same
  tradeoff as the Python prototype, ported as-is). Fine through thousands of
  lines (verified); a very long-running session could eventually make each
  frame's reprocessing noticeably slower.
- Same background-dispatch caveat as `replay.html`: a subagent's completion
  stats only ever land in *its own* file, and the live view says so rather
  than implying it's stuck.
- Nothing here is deployed anywhere — it's a local dev server
  (`npm run dev`/`npm run build && npm run start`), not something with a
  shareable link the way `replay.html`'s Artifact is.
