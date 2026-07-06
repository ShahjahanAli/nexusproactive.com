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

> **Important:** `NEXT_PUBLIC_API_URL` is baked in at **build** time. Rebuild the dashboard after changing it.

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

## Nginx reverse proxy (recommended)

Expose HTTPS on 443 instead of raw ports 5000 / 6100.

**API** — `api.yourdomain.com`:

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # ssl_certificate ...

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # SSE chat streams
        proxy_buffering off;
        proxy_cache off;
    }
}
```

**Dashboard** — `app.yourdomain.com`:

```nginx
server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:6100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Widget embed on client sites:

```html
<script>window.NEXUS_API_URL = 'https://api.yourdomain.com';</script>
<script src="https://api.yourdomain.com/widget/nexus.js" defer></script>
<nexus-chat site-id="..."></nexus-chat>
```

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
| Widget script 404 | Run `npm run build -w @nexus/widget`; restart API |
| CORS errors | Set `CORS_ORIGIN` to your dashboard URL (no trailing slash) |
| Wrong API in dashboard UI | Rebuild dashboard after changing `NEXT_PUBLIC_API_URL` |
