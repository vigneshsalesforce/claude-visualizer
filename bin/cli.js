#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
claude-visualizer — Interactive Claude Code transcript visualizer

Usage:
  claude-visualizer [TRANSCRIPT_PATH] [OPTIONS]

Examples:
  claude-visualizer                                    # Auto-detect from current directory
  claude-visualizer ~/.claude/projects/.../session.jsonl
  claude-visualizer /path/to/session.jsonl --port 3100

Environment:
  TRANSCRIPT_PATH    Transcript file to visualize (auto-detected if not set)
  PORT              Port to run the app on (default: 3000)
    `);
  process.exit(0);
}

const args = process.argv.slice(2);
let transcriptPath = args.find(arg => arg.endsWith('.jsonl')) || process.env.TRANSCRIPT_PATH;

if (!transcriptPath) {
  const cwd = process.cwd();
  const sanitized = cwd.replace(/[:\\/]/g, '-').toLowerCase();
  const claudeDir = path.join(os.homedir(), '.claude', 'projects', sanitized);

  if (fs.existsSync(claudeDir)) {
    const jsonlFiles = fs.readdirSync(claudeDir).filter(f => f.endsWith('.jsonl'));
    if (jsonlFiles.length > 0) {
      jsonlFiles.sort((a, b) => {
        const aTime = fs.statSync(path.join(claudeDir, a)).mtime;
        const bTime = fs.statSync(path.join(claudeDir, b)).mtime;
        return bTime - aTime;
      });
      transcriptPath = path.join(claudeDir, jsonlFiles[0]);
      console.log(`📋 Found transcript: ${jsonlFiles[0]}`);
    }
  }
}

const webDir = path.join(__dirname, '..', 'web');
const env = { ...process.env };

if (transcriptPath) {
  env.TRANSCRIPT_PATH = transcriptPath;
  console.log(`🎯 Using transcript: ${transcriptPath}`);
}

function startDevServer() {
  console.log(`🚀 Starting Claude Code visualizer...`);
  console.log(`📺 Open http://localhost:${env.PORT || 3000} in your browser\n`);

  const spawnArgs = ['run', 'dev'];
  const extraArgs = args.filter(a => !a.endsWith('.jsonl') && a !== '--help' && a !== '-h');
  if (extraArgs.length > 0) {
    spawnArgs.push('--');
    spawnArgs.push(...extraArgs);
  }

  const proc = spawn('npm', spawnArgs, {
    cwd: webDir,
    env,
    stdio: 'inherit',
    shell: true
  });

  proc.on('error', (err) => {
    console.error('Failed to start visualizer:', err.message);
    if (err.code === 'ENOENT') {
      console.error('npm not found. Please ensure Node.js and npm are installed.');
    }
    process.exit(1);
  });

  proc.on('exit', (code) => {
    process.exit(code);
  });

  process.on('SIGINT', () => {
    proc.kill('SIGINT');
    process.exit(0);
  });
}

// Check for the "next" package itself rather than a .bin shim: shim naming/format
// varies across npm versions and platforms (next / next.cmd / next.ps1 on Windows),
// while the package directory is always laid out the same way by npm on every OS.
const nextPkg = path.join(webDir, 'node_modules', 'next', 'package.json');

if (!fs.existsSync(nextPkg)) {
  console.log('📦 First run detected — installing visualizer dependencies (this may take a minute)...');
  const install = spawn('npm', ['install'], {
    cwd: webDir,
    env,
    stdio: 'inherit',
    shell: true
  });

  install.on('error', (err) => {
    console.error('Failed to install dependencies:', err.message);
    if (err.code === 'ENOENT') {
      console.error('npm not found. Please ensure Node.js and npm are installed and on your PATH.');
    }
    process.exit(1);
  });

  install.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Dependency installation failed (npm exited with code ${code}).`);
      console.error(`You can try installing manually with:\n  cd "${webDir}"\n  npm install`);
      if (process.platform === 'win32') {
        console.error('If the error mentions long paths or ENAMETOOLONG, enable Windows long path support:\n  git config --system core.longpaths true\n  (and enable "Enable Win32 long paths" via gpedit.msc or the registry)');
      } else {
        console.error('If the error mentions EACCES/permission denied, avoid installing global npm packages with sudo — consider using a Node version manager (nvm/fnm/volta) instead.');
      }
      process.exit(code);
    }
    startDevServer();
  });
} else {
  startDevServer();
}
