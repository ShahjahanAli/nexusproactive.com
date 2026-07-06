/**
 * PM2 process manager — run API + Dashboard from the monorepo root.
 *
 * npm workspaces hoist dependencies to the root node_modules, so the dashboard
 * must be started via `npm run start -w @nexus/dashboard` (not apps/dashboard/node_modules/next).
 *
 * Usage (on the VM, after build + migrate):
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save
 *   pm2 startup   # follow the printed command for boot on reboot
 */
const path = require('path');
const fs = require('fs');

const root = __dirname;

function resolveNextBin() {
  const candidates = [
    path.join(root, 'node_modules/next/dist/bin/next'),
    path.join(root, 'apps/dashboard/node_modules/next/dist/bin/next'),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

const nextBin = resolveNextBin();

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
    nextBin
      ? {
          name: 'nexus-dashboard',
          cwd: path.join(root, 'apps/dashboard'),
          script: nextBin,
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
        }
      : {
          name: 'nexus-dashboard',
          cwd: root,
          script: 'npm',
          args: 'run start -w @nexus/dashboard',
          interpreter: 'none',
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
