# Nexus Widget

**Action-native conversational layer for your backend.**

Nexus Widget is an open-source platform that turns your existing REST API into a safe, intelligent chat experience. It ingests your **OpenAPI spec**, builds a live **Action Graph**, routes visitors to specialist agents (and optional tenant CX Agents), and executes backend operations with tiered risk controls — read-only calls run immediately; writes require undo windows or inline approval.

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
| One-size-fits-all replies | Router + specialists + tenant CX Agents |
| All-or-nothing API access | Risk tiers: read-only, reversible write, approval-gated financial actions |
| Visitor speaks French, agent speaks English | Language detection, English handoff brief, localized visitor notices |
| No audit trail | Conversation logs, token telemetry, visitor profiles, CX leaderboard |

---

## Features

- **OpenAPI ingestion** — Automatically maps endpoints to LLM tools with AI-assisted risk classification
- **Multi-agent orchestration** — Router classifies intent; billing / technical / sales / account specialists get filtered tool subsets
- **CX Agents** — Tenant-configurable AI personas with capacity limits, knowledge, sales goals, ratings, specialist consults, live graph, and leaderboard (gated by plan)
- **Streaming chat widget** — Embeddable Web Component; **served from your Nexus API** (no per-client file copy)
- **Risk-gated execution**
  - `read_only` — executes immediately
  - `reversible_write` — executes with a 5-minute undo window
  - `irreversible_write` / `financial` — inline approval card + one-time scoped JWT
- **Human handoff** — Live inbox, claim / reply / return to AI, English agent brief, language flags on live chats
- **Multilingual visitors** — Detects language from visitor messages (including short greetings like “Bonjour”), stores it on the conversation, localizes system notices
- **Scoped JWT security** — Short-lived tokens bind each API call to `site_id`, `visitor_id`, and allowed `operation_id`s
- **Visitor tracking** — Anonymous browser IDs or logged-in `visitor-id` attribute; unique visitor analytics
- **Session persistence** — Conversations survive page refresh via API history + localStorage fallback
- **Tenant dashboard** — Deployments, Action Graph, conversations (stats + chat transcript), signals, CX Agents, billing (Stripe)
- **Platform admin** — Super-admin portal for tenants, plans, and CX Agent plan limits
- **Product signals** — Clusters unknown intents and can draft an OpenAPI stub for the missing capability
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
    ADMIN[Next.js Admin]
    ORCH[Orchestrator]
    CX[CX Agents]
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
  ADMIN --> API
  API --> ORCH
  ORCH --> CX
  ORCH --> AG
  ORCH --> LLM
  ORCH -->|scoped JWT| BE
  API --> PG
```

**Monorepo layout:**

```
nexus-widget/
├── apps/
│   ├── api/          # Express API — auth, orchestration, CX Agents, webhooks, widget SSE
│   ├── dashboard/    # Next.js 16 tenant dashboard + marketing site (port 6100)
│   ├── admin/        # Next.js platform admin portal (port 6200)
│   └── widget/       # Embeddable <nexus-chat> Web Component (Vite IIFE bundle)
├── packages/
│   └── shared-types/ # Shared TypeScript types
├── scripts/
│   ├── free-and-run.js   # Kill whatever is on a port, then start the service
│   └── start-all.js      # Stop/start API + dashboard + admin together
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
ADMIN_URL=http://localhost:6200
CORS_ORIGIN=http://localhost:6100
CORS_ORIGINS=http://localhost:6100,http://localhost:6200
PLATFORM_ADMIN_EMAIL=admin@nexusproactive.com
PLATFORM_ADMIN_PASSWORD=change-me-platform-admin
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

**All services at once** (frees ports 5000 / 6100 / 6200 first, then starts API, dashboard, and admin):

```bash
npm run start:all
```

Or in separate terminals during development:

```bash
npm run dev:api         # API → http://localhost:5000 (also serves /widget/nexus.js)
npm run dev:dashboard   # Dashboard → http://localhost:6100
npm run dev:admin       # Admin → http://localhost:6200
npm run dev:widget      # Optional — Vite dev server for widget live reload only
```

| Script | What it does |
|--------|----------------|
| `npm run start:all` / `restart:all` | Free 5000, 6100, 6200 then start API + dashboard + admin |
| `npm run stop:all` | Stop whatever is on those ports |
| `npm run start:api` | Free 5000, start API |
| `npm run start:dashboard` | Free 6100, start dashboard |
| `npm run start:admin` | Free 6200, start admin |

Verify the widget script: [http://localhost:5000/widget/nexus.js](http://localhost:5000/widget/nexus.js)

### 5. Onboard your first deployment

1. Open [http://localhost:6100/signup](http://localhost:6100/signup) and create a tenant
2. Go through **Onboarding** — add your site name, domain, backend URL, and **OpenAPI spec URL**
3. Review ingested actions at **Deployments → Action Graph**
4. Copy the embed snippet and add it to a test page
5. Optional: create CX Agents under **CX Agents** (requires the plan to allow them — set limits in the Admin portal)

Platform admin: [http://localhost:6200/login](http://localhost:6200/login) with `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`.

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

## CX Agents

CX Agents are tenant-owned AI personas that handle a capped number of chats at once. All sites under a tenant share the same agent pool.

| Capability | Notes |
|------------|--------|
| Create / clone / pause | Clone copies config and agent-scoped knowledge; new clones start as `draft` |
| Knowledge | Shared defaults (editable, installable starters) + per-agent overrides |
| Specialist consults | Internal calls to Billing / Technical / Sales / Account — not shown to the visitor |
| Sales + ratings | Agents can log sales events and ask the visitor for a 1–5 rating |
| Live graph | Real-time map of CX Agents ↔ visitor threads ↔ specialists ↔ human agents |
| Leaderboard | Handling volume, sales events, average rating |

Plan knobs (Admin portal → plan or tenant): `cx_agents_enabled`, `max_cx_agents`, concurrent-chat caps, consults, ratings, leaderboard, live graph, knowledge item cap. Saving a plan can sync new limits onto tenants on that plan (merge, not overwrite of tenant overrides).

---

## Language & human handoff

1. Visitor language is detected on **every visitor message** and stored on the conversation (so live chats show a flag before any escalation).
2. On escalate, Nexus writes an **English handoff brief** for the claiming agent (intent, chronology, key details, suggested next step).
3. Visitor-facing system notices (queue, agent joined, AI resumed) are localized when a catalog exists (currently EN / FR / ES / DE).
4. Live chats, the escalation inbox, and conversation logs show a language tag (flag + code). Non-English is highlighted.

Agent-to-visitor live translation (human types English, visitor sees Spanish) is **not implemented yet**.

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
| Conversations | `/app/conversations` | Stats, dated threads, chat-style transcript |
| Visitors | `/app/visitors` | Unique visitor registry and profiles |
| Human inbox | `/app/escalations` | Claim and reply to escalated chats |
| CX Agents | `/app/cx-agents` | Personas, clone, default knowledge |
| CX Live Graph | `/app/cx-agents/live` | Live connections across agents and chats |
| CX Leaderboard | `/app/cx-agents/leaderboard` | Handling and sales performance |
| Team | `/app/team` | Tenant users and roles |
| Integrations | `/app/integrations` | Outbound webhooks and proactive triggers |
| Telemetry | `/app/analytics` | Tokens, visitors, API action activity |
| Product Signals | `/app/signals` | Unsupported intent clustering + API stubs |
| Billing | `/app/billing` | Stripe plans and usage caps |

**Admin portal** (`/admin`, port 6200): tenants, plan catalog (including CX Agent limits), audit log.

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
| `POST /v1/chat/rating` | Public | Visitor CX Agent rating |
| `GET /health` | Public | DB / Redis health |
| `/auth/*` | Public | Signup, login, session |
| `/sites/*` | Tenant JWT | Deployment management + ingest |
| `/conversations/*` | Tenant JWT | Conversation logs + stats |
| `/escalations/*` | Tenant JWT | Human inbox (claim, reply, resolve) |
| `/tenant/cx-agents/*` | Tenant JWT | CX Agents, knowledge, consults, live graph, leaderboard |
| `/webhook-subscriptions/*` | Tenant JWT | Outbound event webhooks |
| `/proactive/*` | Tenant JWT | Proactive trigger rules |
| `/visitors/*` | Tenant JWT | Visitor analytics + memory |
| `/tenant/analytics` | Tenant JWT | Usage telemetry |
| `/platform/*` | Platform admin | Tenants, plans, audit |
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

# Run / stop everything (production-style start after a build)
npm run start:all
npm run stop:all

# Dev mock backend (non-production)
# Point site backend_base_url to http://localhost:5000/dev/mock
```

See [RUNBOOK.md](RUNBOOK.md) for operations: JWT rotation, forced re-ingest, Stripe webhook replay, and more.

**Production on a VM:** [docs/DEPLOY-PM2.md](docs/DEPLOY-PM2.md) — PM2 setup for API + Dashboard + Admin from the monorepo root.

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
| `PUBLIC_API_URL` | Public API base URL for production embeds |
| `ADMIN_URL` | Platform admin origin (default `http://localhost:6200`) |
| `CORS_ORIGINS` | Comma-separated allowed origins (dashboard + admin) |
| `PLATFORM_ADMIN_EMAIL` / `PASSWORD` | Seeded super-admin login |
| `DISPLAY_TIMEZONE` / `NEXT_PUBLIC_DISPLAY_TIMEZONE` | Dashboard timestamps (default `Asia/Dhaka`) |

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
- [x] Language detection + English handoff brief + localized visitor notices
- [x] CX Agents (personas, consults, knowledge, live graph, leaderboard)
- [ ] Live translation of human-agent replies into the visitor’s language
- [ ] Additional visitor-facing locale catalogs beyond EN / FR / ES / DE

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgments

Built for teams who want conversational AI that respects their API contracts, security boundaries, and operational limits — not a black-box that guesses.

**Questions or ideas?** [Open an issue](https://github.com/your-org/nexus-widget/issues).
