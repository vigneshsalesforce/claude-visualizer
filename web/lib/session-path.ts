import fs from "fs";
import os from "os";
import path from "path";

/** Matches Claude Code's own project-directory naming: every '/', '\', ':' -> '-'. */
export function sanitizeCwd(cwd: string): string {
  return cwd.replace(/[\\/:]/g, "-");
}

/**
 * Claude Code records a project directory for the cwd a session was
 * actually started in. If this process was launched from a subdirectory of
 * that (e.g. `npm run dev` from a nested `web/` folder), walk up until we
 * find an existing project directory.
 */
function findProjectDir(startDir: string): string {
  const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");
  let dir = startDir;
  while (true) {
    const candidate = path.join(claudeProjectsDir, sanitizeCwd(dir));
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `No project directory found under ${claudeProjectsDir} for ${startDir} or any parent directory\n` +
          "Pass a session .jsonl path explicitly instead."
      );
    }
    dir = parent;
  }
}

export function findMainTranscript(explicitPath?: string): string {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (!fs.statSync(resolved).isFile()) {
      throw new Error(`Not a file: ${resolved}`);
    }
    return resolved;
  }

  const projectDir = findProjectDir(process.cwd());
  const candidates = fs
    .readdirSync(projectDir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(projectDir, f))
    .filter((p) => fs.statSync(p).isFile());
  if (candidates.length === 0) {
    throw new Error(`No .jsonl session files found in ${projectDir}`);
  }
  return candidates.reduce((newest, p) =>
    fs.statSync(p).mtimeMs > fs.statSync(newest).mtimeMs ? p : newest
  );
}

export function subagentsDirFor(mainPath: string): string {
  const parsed = path.parse(mainPath);
  return path.join(parsed.dir, parsed.name, "subagents");
}

/**
 * All session transcripts in the current project directory, for
 * multi-session tailing. Returns just the one file when TRANSCRIPT_PATH is
 * set explicitly (preserves the original single-session override behavior —
 * that path may point outside any `~/.claude/projects/...` directory, e.g.
 * at a saved replay file, so sibling discovery wouldn't make sense there).
 */
export function findSessionTranscripts(explicitPath?: string): string[] {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (!fs.statSync(resolved).isFile()) {
      throw new Error(`Not a file: ${resolved}`);
    }
    return [resolved];
  }

  const projectDir = findProjectDir(process.cwd());
  return fs
    .readdirSync(projectDir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(projectDir, f))
    .filter((p) => fs.statSync(p).isFile());
}

export function sessionIdFor(filePath: string): string {
  return path.parse(filePath).name;
}
