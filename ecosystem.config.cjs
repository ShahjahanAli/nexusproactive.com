/**
 * PM2 — API + Dashboard from monorepo root.
 *
 * Dashboard: run Next.js via root node_modules (npm workspaces hoist deps there).
 * Do NOT use `npm run -w @nexus/dashboard` — fails if workspaces aren't resolved.
 *
 *   pm2 start ecosystem.config.cjs --env production
 */
const path = require('path');
const fs = require('fs');

const root = __dirname;

function requireNextBin() {
  const candidates = [
    path.join(root, 'node_modules/next/dist/bin/next'),
    path.join(root, 'apps/dashboard/node_modules/next/dist/bin/next'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      'Next.js not found. From repo root run: npm ci && npm run build -w @nexus/dashboard',
    );
  }
  return found;
}

const nextBin = requireNextBin();

module.exports = {
  apps: [
    {
      name: 'nexus-api',
      cwd: path.join(root, 'apps/api'),
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: '5000',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '5000',
      },
    },
    {
      name: 'nexus-dashboard',
      cwd: path.join(root, 'apps/dashboard'),
      script: nextBin,
      interpreter: 'node',
      args: 'start -p 6100',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'development',
        PORT: '6100',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '6100',
      },
    },
  ],
};
