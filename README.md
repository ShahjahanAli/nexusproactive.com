# Nexus Widget

**Action-native conversational layer for your backend.**

Nexus Widget is an open-source platform that turns your existing REST API into a safe, intelligent chat experience. It ingests your **OpenAPI spec**, builds a live **Action Graph**, routes visitors to specialist agents, and executes backend operations with tiered risk controls — read-only calls run immediately; writes require undo windows or inline approval.

> Not another FAQ bot. Nexus **does things** on your API — with guardrails.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

---

## Why Nexus?

| Typical chatbots | Nexus Widget |
|------------------|--------------|
| Answer from docs / RAG | Call your live API endpoints |
| Static webhook flows | Auto-discovered OpenAPI Action Graph |
| One-size-fits-all replies | Router + specialist agents (billing, technical, sales, account) |
| All-or-nothing API access | Risk tiers: read-only, reversible write, approval-gated financial actions |
| No audit trail | Conversation logs, token telemetry, visitor profiles |

---

## Features

- **OpenAPI ingestion** — Automatically maps endpoints to LLM tools with AI-assisted risk classification
- **Multi-agent orchestration** — Router classifies intent; specialists get filtered tool subsets
- **Streaming chat widget** — Embeddable Web Component; **served from your Nexus API** (no per-client file copy)
- **Risk-gated execution**
  - `read_only` — executes immediately
  - `reversible_write` — executes with a 5-minute undo window
  - `irreversible_write` / `financial` — inline approval card + one-time scoped JWT
- **Scoped JWT security** — Short-lived tokens bind each API call to `site_id`, `visitor_id`, and allowed `operation_id`s
- **Visitor tracking** — Anonymous browser IDs or logged-in `visitor-id` attribute; unique visitor analytics
- **Session persistence** — Conversations survive page refresh via API history + localStorage fallback
- **Tenant dashboard** — Deployments, Action Graph review, communications, telemetry, billing (Stripe)
- **Product signals** — Clusters unknown intents for product discovery
- **LLM-agnostic** — Any OpenAI-compatible `/v1/chat/completions` endpoint (OpenAI, LiteLLM, Ollama, etc.)

---

## Architecture

```mermaid
flowchart LR
  subgraph client_site [Client Website]
    W[nexus-chat widget]
  end

  subgraph nexus [Nexus Platform]
    API[Express API]
    DASH[Next.js Dashboard]
    ORCH[Orchestrator]
    AG[Action Graph]
  end

  subgraph external [External Services]
    LLM[LLM Provider]
    PG[(PostgreSQL)]
    BE[Client Backend API]
  end

  W -->|load script| API
  W -->|SSE chat| API
  DASH --> API
  API --> ORCH
  ORCH --> AG
  ORCH --> LLM
  ORCH -->|scoped JWT| BE
  API --> PG
```

**Monorepo layout:**

```
nexus-widget/
├── apps/
│   ├── api/          # Express API — auth, orchestration, webhooks, widget SSE
│   ├── dashboard/    # Next.js 16 tenant dashboard + marketing site
│   └── widget/       # Embeddable <nexus-chat> Web Component (Vite IIFE bundle)
├── packages/
│   └── shared-types/ # Shared TypeScript types
├── docs/
│   └── client-middleware/   # Express + Laravel JWT verification samples
├── RUNBOOK.md        # Operations guide
└── .env.example      # Environment template
```

---

## Quick start

### Prerequisites

- **Node.js** 20+
- **PostgreSQL** 14+
- **Redis** (optional in development — set `REDIS_ENABLED=true` to enable)
- An **OpenAI-compatible LLM** API key

### 1. Clone and install

```bash
git clone https://github.com/your-org/nexus-widget.git
cd nexus-widget
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your database URL, JWT secret, and LLM credentials. Minimum required:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexus_widget
JWT_SECRET=change-me-in-production-min-32-chars
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_DEFAULT_MODEL=gpt-4o-mini
NEXT_PUBLIC_API_URL=http://localhost:5000
DASHBOARD_URL=http://localhost:6100
CORS_ORIGIN=http://localhost:6100
```

### 3. Database

```bash
createdb nexus_widget   # if needed
npm run db:migrate
```

### 4. Build and run

Build the widget once (the API serves it from `apps/widget/dist`):

```bash
npm run build -w @nexus/widget
```

In separate terminals:

```bash
npm run dev:api         # API → http://localhost:5000 (also serves /widget/nexus.js)
npm run dev:dashboard   # Dashboard → http://localhost:6100
npm run dev:widget      # Optional — Vite dev server for widget live reload only
```

Verify the script is available: [http://localhost:5000/widget/nexus.js](http://localhost:5000/widget/nexus.js)

### 5. Onboard your first deployment

1. Open [http://localhost:6100/signup](http://localhost:6100/signup) and create a tenant
2. Go through **Onboarding** — add your site name, domain, backend URL, and **OpenAPI spec URL**
3. Review ingested actions at **Deployments → Action Graph**
4. Copy the embed snippet and add it to a test page

---

## Widget embed

Client sites only add a **script tag** — you do **not** copy `nexus.iife.js` into their `public/` folder. The Nexus API hosts the bundle; every client loads it from your server.

```html
<script>
  window.NEXUS_API_URL = 'http://localhost:5000';
</script>
<script src="http://localhost:5000/widget/nexus.js" defer></script>
<nexus-chat site-id="YOUR-SITE-UUID"></nexus-chat>
```

**Production** — replace with your public API URL:

```html
<script>
  window.NEXUS_API_URL = 'https://api.yourdomain.com';
</script>
<script src="https://api.yourdomain.com/widget/nexus.js" defer></script>
<nexus-chat site-id="YOUR-SITE-UUID"></nexus-chat>
```

**Logged-in users** (stable ID across devices):

```html
<nexus-chat site-id="YOUR-SITE-UUID" visitor-id="user_12345"></nexus-chat>
```

The embed snippet in the dashboard (**Deployments → Edit**) is generated automatically from `NEXT_PUBLIC_API_URL`.

### Serving the widget from your server

| Step | Command / URL |
|------|----------------|
| Build bundle | `npm run build -w @nexus/widget` → `apps/widget/dist/nexus.iife.js` |
| Served by API | `GET /widget/nexus.js` (alias) or `GET /widget/nexus.iife.js` |
| After widget updates | Rebuild widget + restart API — all client sites pick up the new script |

```
Client website                    Your Nexus server
──────────────                    ─────────────────
<script src="https://api.../widget/nexus.js">
        │                                    │
        └──────── HTTP GET ──────────────────┘
                     apps/widget/dist/nexus.iife.js
```

**Optional CDN** — Put Cloudflare, Nginx, or object storage in front of `/widget/*` for caching. The embed URL can point at `cdn.yourdomain.com/widget/nexus.js` as long as it proxies or mirrors the same file.

Anonymous visitors receive a persistent UUID in `localStorage` (`nexus_visitor_id`). Conversations persist across page refreshes via stored `conversationId` and `GET /v1/chat/history`.

---

## Securing your backend

Nexus mints **scoped JWTs** for each tool execution. Your backend must verify them before honoring the request.

Sample middleware is included:

- [Express](docs/client-middleware/express/verifyNexusScopedJwt.ts)
- [Laravel](docs/client-middleware/laravel/VerifyNexusScopedJwt.php)

Each token carries:

- `site_id` — which deployment initiated the call
- `visitor_id` — which end-user triggered it
- `allowed_operation_ids` — exact OpenAPI operation(s) permitted for this request

Reject tampered, expired, or out-of-scope tokens at your API boundary.

---

## Dashboard

| Section | Path | Description |
|---------|------|-------------|
| Command Center | `/app` | Overview and usage |
| Deployments | `/app/sites` | Sites, OpenAPI ingest, Action Graph review |
| Communications | `/app/conversations` | Live conversation feed |
| Visitors | `/app/visitors` | Unique visitor registry and profiles |
| Human inbox | `/app/escalations` | Claim and reply to escalated chats |
| Integrations | `/app/integrations` | Outbound webhooks and proactive triggers |
| Telemetry | `/app/analytics` | Tokens, visitors, API action activity |
| Product Signals | `/app/signals` | Unsupported intent clustering |
| Billing | `/app/billing` | Stripe plans and usage caps |

---

## API overview

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /widget/nexus.js` | Public | Widget bundle (served from `apps/widget/dist`) |
| `GET /v1/widget/config` | Public | Widget theme + site config |
| `POST /v1/chat` | Public (site + visitor) | SSE chat stream |
| `GET /v1/chat/history` | Public | Restore conversation messages |
| `POST /v1/chat/escalate` | Public | Request human agent |
| `POST /v1/chat/context` | Public | Page context + proactive triggers |
| `POST /v1/chat/approve` | Public | Confirm approval-gated action |
| `POST /v1/chat/undo/:id` | Public | Undo reversible write |
| `GET /health` | Public | DB / Redis health |
| `/auth/*` | Public | Signup, login, session |
| `/sites/*` | Tenant JWT | Deployment management + ingest |
| `/conversations/*` | Tenant JWT | Conversation logs |
| `/escalations/*` | Tenant JWT | Human inbox (claim, reply, resolve) |
| `/webhook-subscriptions/*` | Tenant JWT | Outbound event webhooks |
| `/proactive/*` | Tenant JWT | Proactive trigger rules |
| `/visitors/*` | Tenant JWT | Visitor analytics + memory |
| `/tenant/analytics` | Tenant JWT | Usage telemetry |
| `/webhooks/stripe` | Stripe signature | Billing events |

---

## Development

```bash
# Build all workspaces (includes widget → API can serve /widget/nexus.js)
npm run build

# Rebuild widget only after UI changes
npm run build -w @nexus/widget

# Database
npm run db:migrate
npm run db:migrate:status
npm run db:rollback
npm run db:make:migration

# Dev mock backend (non-production)
# Point site backend_base_url to http://localhost:5000/dev/mock
```

See [RUNBOOK.md](RUNBOOK.md) for operations: JWT rotation, forced re-ingest, Stripe webhook replay, and more.

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `5000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Tenant session + scoped JWT signing |
| `LLM_BASE_URL` | OpenAI-compatible API base URL |
| `LLM_API_KEY` | LLM provider API key |
| `LLM_DEFAULT_MODEL` | Primary model for chat |
| `REDIS_ENABLED` | `true` to enable Redis (optional in dev) |
| `STRIPE_*` | Billing integration (optional for self-hosted) |
| `NEXT_PUBLIC_API_URL` | Dashboard → API URL; used in embed snippets |
| `PUBLIC_API_URL` | Public API base URL for production embeds (e.g. `https://api.yourdomain.com`) |

Full list: [.env.example](.env.example)

---

## Contributing

Contributions are welcome! To get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes and ensure builds pass (`npm run build`)
4. Open a pull request with a clear description

Please keep PRs focused. For larger changes, open an issue first to discuss approach.

---

## Roadmap

- [ ] Self-hosted Docker Compose stack
- [ ] Additional client middleware (FastAPI, NestJS)
- [x] Widget theming API
- [x] Webhook notifications for conversations and approvals
- [ ] Multi-language widget UI

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgments

Built for teams who want conversational AI that respects their API contracts, security boundaries, and operational limits — not a black-box that guesses.

**Questions or ideas?** [Open an issue](https://github.com/your-org/nexus-widget/issues).
