/**
 * PM2 process manager — run API + Dashboard from the monorepo root.
 *
 * Usage (on the VM, after build + migrate):
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save
 *   pm2 startup   # follow the printed command for boot on reboot
 *
 * Logs:
 *   pm2 logs
 *   pm2 logs nexus-api
 *   pm2 logs nexus-dashboard
 */
const path = require('path');

const root = __dirname;

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
      // Root .env is loaded by apps/api/src/config.ts (../../.. from dist)
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
      script: 'node_modules/next/dist/bin/next',
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
