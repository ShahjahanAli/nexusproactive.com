# Production deployment with PM2

Run the **API** (port 5000) and **Dashboard** (port 6100) from one monorepo on a VM using [PM2](https://pm2.keymetrics.io/).

## Prerequisites on the VM

- **Node.js 20+**
- **PostgreSQL** (and optionally Redis)
- **PM2** globally: `npm install -g pm2`
- **Git** clone of this repo

## 1. Install and configure

```bash
cd /var/www/nexus-widget   # or your deploy path
git pull                   # on updates

npm ci                     # install all workspace deps from root
cp .env.example .env       # first time only — then edit
```

Edit `.env` for production (minimum):

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:pass@localhost:5432/nexus_widget
JWT_SECRET=your-long-random-secret-min-32-chars
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...

# Public URLs (use your real domains)
PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
DASHBOARD_URL=https://app.yourdomain.com
CORS_ORIGIN=https://app.yourdomain.com
```

> **Embed snippets** use `PUBLIC_API_URL` at **runtime** (no rebuild needed when only that changes).  
> `NEXT_PUBLIC_API_URL` is still baked in at **build** time for other client-side dashboard calls — rebuild if you change it.

## 2. Build

```bash
npm run build -w @nexus/widget   # widget bundle → served at /widget/nexus.js
npm run build                    # API (tsc) + Dashboard (next build)
```

## 3. Database migrate

```bash
npm run db:migrate
```

## 4. Start with PM2

From the **repo root**:

```bash
pm2 start ecosystem.config.cjs --env production
```

Or via npm:

```bash
npm run pm2:start
```

Check status:

```bash
pm2 status
pm2 logs
curl http://127.0.0.1:5000/health
curl -I http://127.0.0.1:6100
```

## 5. Persist across reboots

```bash
pm2 save
pm2 startup
# Run the command PM2 prints (sudo env PATH=... pm2 startup ...)
```

## PM2 commands

| Command | Purpose |
|---------|---------|
| `pm2 status` | List processes |
| `pm2 logs nexus-api` | API logs |
| `pm2 logs nexus-dashboard` | Dashboard logs |
| `pm2 restart ecosystem.config.cjs --env production` | Restart both |
| `pm2 stop ecosystem.config.cjs` | Stop both |
| `npm run pm2:restart` | Same as restart (from root) |

## Deploy updates

```bash
git pull
npm ci
npm run build -w @nexus/widget
npm run build
npm run db:migrate
pm2 restart ecosystem.config.cjs --env production
```

## Nginx reverse proxy

PM2 binds to **localhost only** (`5000` / `6100`). Nginx terminates HTTPS and proxies to those ports.

### Architecture

```
Internet
   │
   ├─ https://api.yourdomain.com  ──► Nginx ──► 127.0.0.1:5000  (nexus-api)
   │      /widget/nexus.js
   │      /v1/chat  (SSE)
   │
   └─ https://app.yourdomain.com  ──► Nginx ──► 127.0.0.1:6100  (nexus-dashboard)
```

### `.env` must match your public URLs

```env
NODE_ENV=production
PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
DASHBOARD_URL=https://app.yourdomain.com
CORS_ORIGIN=https://app.yourdomain.com
```

Rebuild the dashboard after changing `NEXT_PUBLIC_API_URL`:

```bash
npm run build -w @nexus/dashboard
pm2 restart nexus-dashboard
```

### Install config

Copy the example and edit domains:

```bash
sudo cp docs/nginx/nexus.conf.example /etc/nginx/sites-available/nexus
sudo nano /etc/nginx/sites-available/nexus
sudo ln -sf /etc/nginx/sites-available/nexus /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Full example: [docs/nginx/nexus.conf.example](nginx/nexus.conf.example)

### SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com -d app.yourdomain.com
```

### DNS records

| Type | Name | Value |
|------|------|-------|
| A | `api` | Your VM public IP |
| A | `app` | Your VM public IP |

### Verify

```bash
curl -s https://api.yourdomain.com/health
curl -I https://api.yourdomain.com/widget/nexus.js
curl -I https://app.yourdomain.com
```

### Widget embed (client sites)

```html
<script>window.NEXUS_API_URL = 'https://api.yourdomain.com';</script>
<script src="https://api.yourdomain.com/widget/nexus.js" defer></script>
<nexus-chat site-id="YOUR-SITE-UUID"></nexus-chat>
```

### Nginx troubleshooting

| Issue | Fix |
|-------|-----|
| Chat streams stall / no tokens | Ensure `/v1/chat` has `proxy_buffering off` and long `proxy_read_timeout` (see example config) |
| CORS errors in dashboard | `CORS_ORIGIN` must exactly match `https://app.yourdomain.com` (no trailing slash) |
| 502 Bad Gateway | PM2 not running — `pm2 status`; check ports with `curl http://127.0.0.1:5000/health` |
| Login cookie not set | Use HTTPS on dashboard; `NODE_ENV=production` enables `secure` cookies |
| Widget 404 | `npm run build -w @nexus/widget` then `pm2 restart nexus-api` |

Do **not** expose ports `5000` / `6100` in the VM firewall — only `80` and `443` need to be public.

## What PM2 runs

| PM2 name | CWD | Command | Port |
|----------|-----|---------|------|
| `nexus-api` | `apps/api` | `node dist/index.js` | 5000 |
| `nexus-dashboard` | `apps/dashboard` | `next start -p 6100` | 6100 |

Both processes use the root `.env` (API loads it explicitly; set dashboard vars before `next build`).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `nexus-api` crashes on start | Run `npm run build -w @nexus/api`; check `pm2 logs nexus-api` |
| Dashboard 404 / won't start | Run `npm run build -w @nexus/dashboard` first (`next build`) |
| PM2 `Script not found` / dashboard won't bind to 6100 | From repo root: `npm ci`, `npm run build -w @nexus/dashboard`, verify `ls node_modules/next/dist/bin/next`, then `pm2 delete all && pm2 start ecosystem.config.cjs --env production` |
| Widget script 404 | Run `npm run build -w @nexus/widget`; restart API |
| CORS errors | Set `CORS_ORIGIN` to your dashboard URL (no trailing slash) |
| Wrong API in dashboard UI | Rebuild dashboard after changing `NEXT_PUBLIC_API_URL` |
