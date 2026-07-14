# Contributing to Claude Code Visualizer

Thanks for considering a contribution. This is a small project, so the process is intentionally lightweight.

## Before you start

- **Bug fix or small change?** Feel free to open a pull request directly.
- **New feature or larger change?** Please open an issue first to discuss the approach — this avoids spent effort on
  something that doesn't fit the project's scope (see the "Scope" note in the [README](./README.md): Claude Code
  transcripts only, not a general agent-visualization tool).

## Local setup

Requires Node.js 18+ and an existing Claude Code session to test against.

```bash
git clone https://github.com/vigneshsalesforce/claude-visualizer.git
cd claude-visualizer/web
npm install
npm run dev
```

This starts the same app the published CLI runs, auto-detecting a transcript from your current directory (see the
README's "Install & run" section for `TRANSCRIPT_PATH` if auto-detect doesn't find one).

Read `web/AGENTS.md` before making changes in `web/` — this project pins a pre-release Next.js version with
breaking changes from what most tooling (and most training data) expects. When in doubt, check
`web/node_modules/next/dist/docs/` for the current API rather than assuming.

## Project layout

- `bin/` — the published CLI (`claude-visualizer`): finds a transcript, ensures dependencies are installed, and
  starts the web app.
- `web/` — the Next.js app itself. This is where nearly all functional changes happen.
  - `web/lib/transcript-parser.ts` — parses the JSONL transcript into turns/tool-calls.
  - `web/lib/tailing.ts` + `web/app/api/events/route.ts` — the live-tailing SSE backend.
  - `web/components/` — the three views (`canvas/`, `tree/`, `graph/`) plus shared UI (toolbar, timeline).

## Before opening a pull request

- Run the linter: `cd web && npm run lint`.
- There's no automated test suite — manually verify your change using the "Verify it's working" steps in the
  README. For UI changes, attach a before/after screenshot to the PR.
- Keep PRs focused. Prefer several small PRs over one large one.
- Write commit messages that explain *why*, not just *what* (the diff already shows what changed).

## Pull request checklist

- [ ] Linted (`npm run lint` in `web/`) with no new warnings
- [ ] Manually tested against a real Claude Code session
- [ ] Screenshot attached, if the change affects the UI
- [ ] README/CONTRIBUTING updated, if the change affects setup or usage

## Reporting bugs / requesting features

Use the issue templates — they ask for just enough detail (repro steps, expected vs. actual, environment) to act on
the report quickly.

## License

By contributing, you agree that your contributions will be licensed under this project's [MIT license](./LICENSE).
