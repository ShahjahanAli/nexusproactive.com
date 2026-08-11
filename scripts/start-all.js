#!/usr/bin/env node
/**
 * Stop anything already running on the service ports, then start all services.
 *
 * Usage:
 *   node scripts/start-all.js          # free ports 5000/6100/6200 and start api, dashboard, admin
 *   node scripts/start-all.js --stop   # only stop whatever is running, don't start anything
 *
 * Output from each service is prefixed with its name. Ctrl+C stops all of them.
 * If one service exits, the others are shut down too.
 */
const { spawn } = require('child_process');
const { freePort } = require('./free-and-run');

const SERVICES = [
  { name: 'api', port: 5000, command: 'npm', args: ['run', 'start', '-w', '@nexus/api'] },
  { name: 'dashboard', port: 6100, command: 'npm', args: ['run', 'start', '-w', '@nexus/dashboard'] },
  { name: 'admin', port: 6200, command: 'npm', args: ['run', 'start', '-w', '@nexus/admin'] },
];

const stopOnly = process.argv.includes('--stop');

let allFree = true;
for (const service of SERVICES) {
  if (!freePort(service.port)) allFree = false;
}
if (!allFree) {
  console.error('[start-all] could not free all ports, aborting');
  process.exit(1);
}

if (stopOnly) {
  console.log('[start-all] all services stopped');
  process.exit(0);
}

const children = [];
let shuttingDown = false;

function prefixStream(stream, label) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) console.log(`[${label}] ${line}`);
    }
  });
  stream.on('end', () => {
    if (buffer.trim()) console.log(`[${label}] ${buffer}`);
  });
}

function shutdownAll(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(exitCode), 500);
}

for (const service of SERVICES) {
  const child = spawn(service.command, service.args, {
    shell: true,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);

  prefixStream(child.stdout, service.name);
  prefixStream(child.stderr, service.name);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.log(
      `[start-all] ${service.name} exited (${signal ?? `code ${code}`}) — stopping remaining services`,
    );
    shutdownAll(code ?? 1);
  });

  console.log(`[start-all] started ${service.name} on port ${service.port}`);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdownAll(0));
}
