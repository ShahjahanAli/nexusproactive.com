#!/usr/bin/env node
/**
 * Free a TCP listen port (if occupied), then optionally run a command.
 *
 * Usage:
 *   node scripts/free-and-run.js <port>                  # stop whatever is listening
 *   node scripts/free-and-run.js <port> <cmd> [args...]   # free port, then start cmd
 *
 * Example:
 *   node scripts/free-and-run.js 6100 npm run start -w @nexus/dashboard
 */
const { execFileSync, spawn } = require('child_process');

function uniquePositivePids(pids) {
  return [...new Set(pids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))];
}

function listeningPidsWindows(listenPort) {
  const ps = `
    $conns = Get-NetTCPConnection -LocalPort ${listenPort} -State Listen -ErrorAction SilentlyContinue
    if ($conns) { $conns | Select-Object -ExpandProperty OwningProcess -Unique }
  `;
  try {
    const out = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', ps],
      { encoding: 'utf8', windowsHide: true },
    );
    return uniquePositivePids(out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
  } catch {
    return [];
  }
}

function listeningPidsUnix(listenPort) {
  try {
    const out = execFileSync('lsof', ['-ti', `TCP:${listenPort}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
    });
    return uniquePositivePids(out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
  } catch {
    return [];
  }
}

function killPid(pid) {
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return true;
    } catch {
      return false;
    }
  }
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Stop whatever is listening on the port. Returns true if the port ends up free.
 */
function freePort(listenPort) {
  const pids =
    process.platform === 'win32'
      ? listeningPidsWindows(listenPort)
      : listeningPidsUnix(listenPort);

  if (pids.length === 0) {
    console.log(`[free-and-run] port ${listenPort} is free`);
    return true;
  }

  console.log(`[free-and-run] port ${listenPort} in use by PID(s): ${pids.join(', ')} — stopping`);
  for (const pid of pids) {
    const ok = killPid(pid);
    console.log(`[free-and-run] ${ok ? 'stopped' : 'failed to stop'} PID ${pid}`);
  }

  // Brief wait so the OS releases the socket (avoids EADDRINUSE races).
  sleep(800);

  const still =
    process.platform === 'win32'
      ? listeningPidsWindows(listenPort)
      : listeningPidsUnix(listenPort);
  if (still.length > 0) {
    console.error(
      `[free-and-run] port ${listenPort} still held by PID(s): ${still.join(', ')}`,
    );
    return false;
  }
  console.log(`[free-and-run] port ${listenPort} is free`);
  return true;
}

module.exports = { freePort };

if (require.main === module) {
  const port = Number.parseInt(process.argv[2] ?? '', 10);
  const command = process.argv[3];
  const args = process.argv.slice(4);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('Usage: node scripts/free-and-run.js <port> [command] [args...]');
    process.exit(1);
  }

  if (!freePort(port)) {
    process.exit(1);
  }

  if (!command) {
    process.exit(0);
  }

  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      if (!child.killed) child.kill(signal);
    });
  }
}
