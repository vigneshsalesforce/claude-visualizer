#!/usr/bin/env node

// Best-effort: pre-install the bundled Next.js app's dependencies so the first
// `claude-visualizer` run doesn't have to wait for an install. This is not the
// only place dependencies get installed — bin/cli.js checks again at startup
// and installs on demand — because some install methods skip lifecycle scripts
// entirely (npx, pnpm/yarn with script approval, `npm install --ignore-scripts`).
// Failures here must never fail the parent `npm install`, so every exit path is 0.

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const webDir = path.join(__dirname, '..', 'web');
const nextPkg = path.join(webDir, 'node_modules', 'next', 'package.json');

if (!fs.existsSync(webDir)) {
  // Running from source without the web/ directory present (shouldn't happen
  // for a published install, but don't ever block on it).
  process.exit(0);
}

if (fs.existsSync(nextPkg)) {
  process.exit(0);
}

try {
  console.log('claude-visualizer: pre-installing visualizer dependencies...');
  const result = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: webDir,
    stdio: 'inherit',
    shell: true
  });
  if (result.status !== 0) {
    console.log('claude-visualizer: dependency pre-install did not complete; it will be retried on first run.');
  }
} catch (err) {
  console.log('claude-visualizer: dependency pre-install skipped (' + err.message + '); it will be retried on first run.');
}

process.exit(0);
