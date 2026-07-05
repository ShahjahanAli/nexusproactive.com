# AI-Native Website Chatbot — Cursor Build Instructions
### Codename: "Nexus Widget" — Action-Native Conversational Layer

---

## 0. What Makes This Different From Existing Chatbot Products

Read this section first — it's the spec for the *thing that doesn't exist yet*, not the plumbing.

Almost every chatbot on the market (Intercom Fin, Drift, Tidio, Crisp, Chatbase, etc.) is one of two things:
1. A **RAG-over-docs FAQ bot** that answers questions but cannot touch the backend, or
2. A **rigid flow-builder bot** where a human pre-wires "if intent = X, call endpoint Y" — no real reasoning, no adaptation when the API changes.

Nexus Widget is neither. It is built around five mechanisms that, combined, don't currently exist as a packaged product:

1. **Auto-Discovered Action Graph** — On connection, Nexus introspects the client's backend (OpenAPI/Swagger spec, GraphQL schema, or a manifest file you write) and builds a live graph of *callable capabilities*, not just *readable documents*. The LLM doesn't get a hardcoded list of "12 supported intents" — it reasons over the graph itself, so a newly added `/api/v2/refund-request` endpoint becomes usable within one schema-refresh cycle, with zero prompt engineering.

2. **Risk-Tiered Autonomous Execution** — Every discovered action is auto-classified (read-only / reversible-write / irreversible-write / financial) using a scoring heuristic + LLM judgment, cached and human-editable in the admin panel. Read-only calls execute immediately. Reversible writes execute with an inline "Undo" affordance rendered directly in the chat bubble. Irreversible/financial actions render an **inline approval card** (not a redirect, not a form — a live component inside the message stream) that the customer taps to confirm, and the backend call only fires after that tap. This is the single biggest gap in the current market: every competitor either can't write to your backend at all, or does it blindly.

3. **Visible Multi-Agent Handoff** — Instead of one opaque model faking omniscience, a lightweight **Router Agent** classifies intent and hands off to specialist sub-agents (Billing, Technical, Sales/Presales, Account) that the user can *see* handing off ("Connecting you to the billing specialist…"), each with scoped tool access. This is closer to how a real support team works, and it lets you swap the model or prompt per-department without touching the others.

4. **Compensating-Transaction Memory (the "Undo Ledger")** — Every write action stores a compensating action alongside it (e.g., `cancel_order` pairs with `restore_order`) in a durable ledger. Undo isn't "ask the LLM to fix it" (unreliable) — it's a deterministic reverse-transaction lookup. This is what makes it safe to let the bot act autonomously at all.

5. **Reverse Intelligence Feed** — Every unresolved or low-confidence conversation is clustered nightly and pushed to a "Product Signals" dashboard for the site owner: *"41 customers this week asked about a feature you don't have: bulk CSV export."* Competitors treat unresolved chats as failures to hide; Nexus treats them as a product-research feed. No existing chatbot product surfaces this as a first-class artifact.

Everything below is the concrete build plan for these five mechanisms plus the supporting scaffolding (widget embed, streaming, auth, admin panel).

---

## 1. Tech Stack (aligned to your existing infra)

| Layer | Choice | Notes |
|---|---|---|
| Embeddable widget | **Vanilla TS + Web Component** (`<nexus-chat>`), built with Vite | Framework-agnostic embed — must work on any customer's site regardless of their stack, single `<script>` tag. Deliberately not Next.js, since it runs inside arbitrary third-party HTML, not inside your app. |
| SaaS backend / API | **Express.js 4.x (Node 20 LTS)** — single service, modularized (`/routes`, `/services`, `/agents`, `/middleware`) | Owns tenancy, billing webhooks, the agent loop, tool-calling, session state, and the public REST API. Pinned to Express 4 (not 5) for ecosystem stability — most middleware (helmet, express-rate-limit, cors) and your existing Laravel-adjacent tooling patterns are best-tested against 4.x. |
| SaaS dashboard (customer-facing) | **Next.js 16 (App Router, Turbopack default, React 19.2)** | Where paying customers sign up, connect a site, review the Action Graph, set risk-tier overrides, view conversations, manage billing, and view Product Signals. Use **Cache Components** (`"use cache"` directive) on read-heavy pages (Action Graph list, conversation history) instead of manual `revalidate` config — this is the correct Next 16 pattern, not the Next 15 implicit-caching model. Route protection uses **`proxy.ts`** (the Next.js 16 replacement for `middleware.ts`) to gate the authenticated `/app` segment. |
| Marketing / signup site | **Next.js 16** — same app as the dashboard (public routes vs. authenticated `/app` routes) is simplest to start | Pricing page, docs, signup → Stripe checkout → onboarding wizard |
| LLM inference | Your existing **LiteLLM gateway** (`litellm.rotsource.com`) → routes to vLLM/Qwen3-Coder-30B-A3B-Instruct-AWQ on RunPod L4, with fallback to Claude via Anthropic API for higher-stakes reasoning (risk classification, approval-card copy) | Express calls this like any upstream API; meter tokens per tenant here for usage-based billing |
| Client backend integration | **OpenAPI ingestion module** (Express service) | Reads each tenant's *end-customer* site's OpenAPI 3.x spec (or GraphQL introspection) to build that tenant's Action Graph |
| DB | PostgreSQL | Tenants (SaaS customers), their connected sites, action graph cache, conversations, undo ledger, billing/subscription state, usage metering |
| Cache/session/queue | Redis | Session state, SSE pub/sub, rate limiting per plan tier, nightly clustering job queue (BullMQ pairs cleanly with Express) |
| Realtime transport | **Server-Sent Events (SSE)** from Express for chat streaming; WebSocket only if you need agent-initiated proactive pushes | SSE is trivial to serve from an Express route and simple to run behind Nginx/Let's Encrypt |
| Auth — SaaS customer → dashboard | Standard session/JWT auth in the Next.js dashboard (NextAuth or a custom Express-issued JWT) | This is your paying customer logging into their account |
| Auth — widget → client backend | Short-lived **scoped session JWT** minted by the Express orchestrator per conversation, signed with a per-tenant secret | The orchestrator never holds the tenant's master API key inside the browser-reachable surface |
| Billing | **Stripe** (subscriptions + usage-based metering add-on) | Plan tiers gate: connected sites, monthly conversation volume, LLM token ceiling, dashboard seats |
| Hosting | DigitalOcean droplet(s) — Nginx + PM2 cluster mode for Express, same or separate droplet for Next.js — mirrors your existing Laravel/Nuxt droplet pattern | Widget static assets on a CDN (Cloudflare/DO Spaces) |

### Version-specific notes for Cursor

Tell Cursor explicitly which major versions you're on — it will otherwise default to older idioms it's seen more of in training:

- **Express 4.x**: use the classic `app.use(express.json())`, callback-style `(req, res, next)` middleware, and `express-async-errors` (or manual try/catch) for async route handlers — Express 4 does not auto-catch rejected promises the way Express 5 does. `package.json` should pin `"express": "^4.19.0"`.
- **Next.js 16**: 
  - Turbopack is the default bundler now — don't add manual Webpack config unless you have a specific incompatibility.
  - Route protection/auth-gating goes in **`proxy.ts`** at the project root, not `middleware.ts` (renamed and now Node.js-runtime-only, no Edge runtime).
  - Use the **`"use cache"`** directive (Cache Components) for the Action Graph review list, conversation history views, and Product Signals dashboard — these are read-heavy, tenant-scoped, and benefit from explicit caching with tag-based invalidation (`cacheTag`/`updateTag`) whenever a spec re-ingest or a new conversation lands.
  - All dynamic/tenant-specific data fetching is request-time by default in Next 16 (no implicit caching surprises) — good fit for a multi-tenant dashboard where stale cross-tenant data would be a real bug, not just a UX annoyance.
  - `package.json` should pin `"next": "^16.0.0"`, `"react": "19.2.x"`, `"react-dom": "19.2.x"`.

---

## 2. High-Level Architecture

```
                    ┌───────────────────────────────────────────┐
                    │   Nexus SaaS Dashboard (Next.js 16)         │
                    │   signup · billing · site connect wizard    │
                    │   action graph review · signals · convos    │
                    └───────────────┬───────────────────────────┘
                                    │ REST (customer session auth)
                                    ▼
┌─────────────────────┐        ┌──────────────────────────────────────────┐
│  Tenant's Website    │        │         Nexus Orchestrator (Express.js)    │
│  <script src=nexus.js│  SSE   │  ┌────────────┐   ┌───────────────────┐  │
│  data-site-id=...>   │◄──────►│  │ Router Agent│──►│ Specialist Agents  │  │
│  <nexus-chat>         │        │  └────────────┘   │ (Billing/Tech/Sales)│  │
└──────────┬───────────┘        │        │            └─────────┬─────────┘  │
           │ REST (scoped JWT)  │        ▼                      ▼            │
           │                    │  ┌────────────┐   ┌───────────────────┐  │
           ▼                    │  │ Action Graph│   │ Risk Classifier    │  │
┌──────────────────────┐        │  │ (per tenant)│   │ + Approval Cards   │  │
│  Tenant's Backend API │◄───────┤  └────────────┘   └─────────┬─────────┘  │
│  (Laravel/Node/etc.)  │  scoped│                              ▼            │
└──────────────────────┘  calls │                     ┌───────────────────┐  │
                            │   │                     │  Undo Ledger (PG)   │  │
                            │   │                     └───────────────────┘  │
                            │   │  Stripe webhooks (billing/usage)           │
                            │   │  LiteLLM Gateway → vLLM (Qwen3-Coder) /    │
                            │   │                      Claude (fallback)     │
                            │   └──────────────────────────────────────────┘
                            │
                            ▼
                     Redis (session, streaming, queue)
                     PostgreSQL (tenants, sites, conversations, graph cache, signals, billing)
```

**Key SaaS distinction:** the Next.js dashboard talks to Express as an authenticated *tenant* (your paying customer, e.g. "Acme Corp"). The embedded widget talks to Express as an anonymous/authenticated *end-visitor* scoped to one of Acme's connected sites. Every table and every JWT claim below carries a `tenant_id` — this is the multi-tenancy boundary, and it should be enforced at the query layer (a `withTenant(tenantId)` query helper), not just at the route layer, so a bug in one route can't leak another tenant's data.

---

## 3. Database Schema (PostgreSQL)

```sql
-- Tenants: one row per PAYING SAAS CUSTOMER (e.g. "Acme Corp")
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT CHECK (plan IN ('trial','starter','growth','scale')) DEFAULT 'trial',
  plan_limits JSONB DEFAULT '{"max_sites":1,"max_conversations_month":500,"max_tokens_month":2000000}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Dashboard users belonging to a tenant (seats)
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('owner','admin','viewer')) DEFAULT 'admin',
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Usage metering, rolled up monthly per tenant for billing + plan enforcement
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  period_start DATE NOT NULL,
  conversations_count INT DEFAULT 0,
  tokens_used BIGINT DEFAULT 0,
  UNIQUE(tenant_id, period_start)
);

-- Sites: one row per WEBSITE a tenant connects (a tenant can have multiple, plan-gated)
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  backend_base_url TEXT NOT NULL,
  openapi_spec_url TEXT,
  jwt_signing_secret TEXT NOT NULL,       -- shared secret with the tenant's backend, encrypted at rest
  widget_theme JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Action Graph: cached, versioned capability list per site
CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id),
  operation_id TEXT NOT NULL,             -- from OpenAPI operationId
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  description TEXT,
  input_schema JSONB,
  risk_tier TEXT CHECK (risk_tier IN ('read_only','reversible_write','irreversible_write','financial')),
  compensating_action_id UUID REFERENCES actions(id), -- for reversible_write
  spec_version INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  reviewed_by_human BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id),
  visitor_id TEXT NOT NULL,               -- anonymous or authenticated customer id
  status TEXT DEFAULT 'open',
  active_agent TEXT DEFAULT 'router',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  role TEXT CHECK (role IN ('user','assistant','system','tool')),
  content TEXT,
  agent_name TEXT,
  tool_calls JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Undo Ledger: deterministic reverse-transaction records
CREATE TABLE action_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  action_id UUID REFERENCES actions(id),
  request_payload JSONB,
  response_payload JSONB,
  status TEXT CHECK (status IN ('pending_approval','executed','undone','failed')),
  undo_deadline TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  undone_at TIMESTAMPTZ
);

-- Reverse Intelligence Feed
CREATE TABLE product_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id),
  cluster_label TEXT,
  representative_message TEXT,
  occurrence_count INT,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  status TEXT DEFAULT 'new'
);
```

---

## 4. Phased Build Plan (9 Phases — build each fully before moving on)

### Phase 0 — SaaS Scaffolding: Tenancy, Auth, Billing
- Scaffold the Express API and the Next.js dashboard as two apps in a monorepo (`/apps/api`, `/apps/dashboard`, `/packages/shared-types` for shared TS types between them). In `/apps/api`, install `express-async-errors` immediately (Express 4 needs it for async route handlers to reject cleanly).
- Build `tenants`, `tenant_users`, `usage_records`, `sites` tables (see schema below). Every Express route that isn't the public widget endpoint must run through a `requireTenantAuth` middleware that resolves `req.tenantId` from the session JWT. In `/apps/dashboard`, gate the authenticated `/app` segment with `proxy.ts` (Next 16's `middleware.ts` replacement) — redirect to `/login` if the session cookie is missing/invalid.
- Build the Next.js signup flow: email/password or magic link → create `tenants` row → Stripe Checkout session (trial with card, or no-card trial, your call) → onboarding wizard stub (site connect comes in Phase 2/6).
- Wire Stripe webhooks into Express (`/webhooks/stripe`): `checkout.session.completed`, `customer.subscription.updated/deleted` → update `tenants.plan` and `plan_limits`.
- Build a `checkPlanLimit(tenantId, metric)` helper used before allowing a new site connection or a new conversation once volume caps are hit — return a friendly in-widget "this business has reached its support capacity" fallback message rather than a hard error.
- **Exit criteria:** you can sign up, get redirected through Stripe test-mode checkout, land in an empty dashboard, and see your tenant's plan reflected correctly after webhook delivery.

### Phase 1 — Orchestrator Skeleton & LiteLLM Wiring
- In `/apps/api`, connect to Postgres and Redis.
- Build a thin `llmClient.ts` wrapping calls to your LiteLLM gateway (`litellm.rotsource.com/v1/chat/completions`), with model selection param (`qwen3-coder-fast` vs `claude-fallback`).
- Implement `/health` and a basic `/v1/chat` SSE streaming endpoint that just echoes the model's streamed tokens, no tools yet.
- **Exit criteria:** you can `curl` the orchestrator and get a streamed LLM response through your own gateway.

### Phase 2 — Action Graph Ingestion
- Build `ingestOpenApiSpec(siteId, specUrl)`: fetch spec, walk `paths`, extract `operationId`, method, path, request schema, description.
- Auto-classify `risk_tier` using a rule pass first (GET → read_only; POST/PUT/PATCH containing `cancel|delete|refund` → irreversible_write; anything touching `payment|charge|invoice` → financial) then an LLM pass to catch ambiguous cases, storing `reviewed_by_human = false` until a human confirms in the admin panel.
- Store results in `actions` table, versioned by `spec_version` (bump on re-ingest, diff against previous version, flag new/changed/removed actions for human review).
- Build a scheduled job (node-cron) that re-ingests each site's spec every N hours and only activates new actions after admin approval — **this is the "self-updating knowledge" mechanism**.
- **Exit criteria:** point it at a real OpenAPI spec (use your PredictArena or travel platform spec as a test fixture) and confirm the `actions` table populates with sane risk tiers.

### Phase 3 — Router Agent + Specialist Agents
- Implement `RouterAgent`: single fast LLM call classifying user message into `{billing, technical, sales, account, unknown}` + confidence score.
- Implement specialist agent configs (`agents/billing.ts`, etc.) — each is a system prompt + a *filtered* view of the Action Graph (only actions tagged relevant to that department, editable in admin).
- Wire handoff logic: orchestrator emits an SSE event `{type: "handoff", from: "router", to: "billing"}` that the widget renders as a visible system bubble ("Connecting you to Billing…").
- **Exit criteria:** a scripted conversation shows router → specialist handoff rendered in a bare-bones test client.

### Phase 4 — Tool-Calling Loop + Risk Gating
- Implement the standard tool-calling loop: LLM proposes a tool call → orchestrator looks up the action's `risk_tier`.
  - `read_only` → execute immediately against the client backend using the scoped JWT, return result to LLM, continue loop.
  - `reversible_write` → execute immediately, write a row to `action_executions` with `undo_deadline = now() + 5 min`, render an inline "Undo" button in that message.
  - `irreversible_write` / `financial` → do **not** execute. Emit an `approval_card` SSE event with a human-readable summary (LLM-generated) of what will happen, and a signed one-time token. Execution only proceeds when the widget POSTs back the customer's tap with that token.
- Implement `/v1/actions/undo/:executionId` — looks up `compensating_action_id`, executes it, marks `undone_at`.
- **Exit criteria:** simulate a fake backend with a `/cancel-order` (irreversible) and `/update-email` (reversible) endpoint; confirm gating behaves correctly end-to-end including undo.

### Phase 5 — Scoped JWT Auth Between Orchestrator and Client Backend
- On conversation start, orchestrator mints a short-lived JWT (5–15 min) scoped to `{site_id, visitor_id, allowed_operation_ids: [...]}`, signed with that site's `jwt_signing_secret`.
- Document the **client-side verification middleware** you'll hand to each client's backend team (Laravel middleware example + Express example) that checks the JWT signature and the `allowed_operation_ids` claim before allowing the call through — this is the security boundary, write it defensively.
- **Exit criteria:** a request with a tampered or expired JWT is rejected by the sample Laravel middleware.

### Phase 6 — Embeddable Widget (Web Component) + Site Connect Wizard
- Build `<nexus-chat>` as a Vite-bundled Web Component with Shadow DOM (style isolation, so it never collides with host site CSS).
- In the Next.js dashboard, build the "Connect a site" wizard: tenant enters domain + OpenAPI spec URL (or uploads a spec file) + backend base URL → Express ingests it (Phase 2 module) → wizard shows the generated embed snippet with that site's UUID baked in, enforcing `plan_limits.max_sites`.
- Embed snippet shown to the tenant:
  ```html
  <script src="https://cdn.yourservice.com/nexus.js" defer></script>
  <nexus-chat site-id="SITE_UUID"></nexus-chat>
  ```
- Widget responsibilities: open SSE connection, render streaming tokens, render `handoff` system bubbles, render inline `approval_card` components (Confirm / Decline buttons that POST the one-time token), render `Undo` buttons with a live countdown to `undo_deadline`.
- Add a "visible reasoning" toggle in the widget footer ("See how this was handled") that expands the router→specialist→action trace for transparency — no competitor exposes this to end users today.
- **Exit criteria:** drop the script tag into a static HTML page and a Next.js page; confirm identical behavior in both.

### Phase 7 — SaaS Dashboard Depth: Action Graph Review, Signals, Billing
- Round out `/apps/dashboard`: Action Graph review table (approve/edit risk tier, view diff on spec re-ingest), live conversation viewer, Undo Ledger, and the **Product Signals** page.
- Product Signals pipeline: nightly job (BullMQ) embeds all `unknown`-routed or low-confidence messages, runs clustering (k-means over embeddings is enough at this scale), writes clusters to `product_signals`, surfaces top clusters by `occurrence_count` per tenant.
- Billing page: current plan, usage-vs-limit bars (pulled from `usage_records`), Stripe customer portal link for upgrade/downgrade/cancel.
- **Exit criteria:** dashboard shows a real approve/reject flow for a new spec version, a manufactured batch of "unsupported feature" messages produces a coherent cluster, and the billing page correctly reflects a plan change made in Stripe test mode.

### Phase 8 — Hardening, Rate Limiting, Observability
- Redis-backed rate limiting per `visitor_id`, per `site_id`, and per `tenant_id` (plan-tier aware — this doubles as plan enforcement).
- Structured logging (pino) with tenant/conversation/action correlation IDs; ship to whatever log sink you already use.
- Load test the SSE endpoint (k6 or autocannon) at expected concurrency.
- Nginx + Let's Encrypt config for `api.yourdomain.com` (Express) and `app.yourdomain.com` (Next.js dashboard), PM2 cluster mode for Express — mirror your existing DigitalOcean droplet pattern.
- Write a `RUNBOOK.md`: how a new tenant onboards end-to-end, how to rotate a `jwt_signing_secret`, how to force a spec re-ingest, how to manually undo a stuck action, how to handle a Stripe webhook replay.

---

## 5. Key Prompts to Seed in Cursor

When you actually start building in Cursor, paste these as the first messages in relevant files to anchor the agent's context fast:

- For the monorepo setup: *"Two apps, `/apps/api` (Express.js, Node 20) and `/apps/dashboard` (Next.js 16 App Router), sharing types via `/packages/shared-types`. Every Express route except the public widget/SSE endpoints must resolve `req.tenantId` via a `requireTenantAuth` middleware — read section 4 Phase 0 first."*
- For the Action Graph module: *"This ingests an OpenAPI 3.x spec and produces a risk-classified, versioned list of callable actions, scoped to a `site_id` which belongs to a `tenant_id`. Read section 3/4 of `cursor-ai-native-chatbot-build-plan.md` before writing code."*
- For the tool-calling loop: *"Follow the exact risk-gating behavior in Phase 4 — read_only executes immediately, reversible_write executes + logs an undo record, irreversible/financial NEVER execute without a client-approved one-time token."*
- For the widget: *"Web Component with Shadow DOM, framework-agnostic (no Next.js, no React runtime dependency), must render SSE-streamed tokens plus three custom event types: handoff, approval_card, undo_available."*
- For the dashboard: *"Next.js 16 App Router, server components for data-heavy pages (Action Graph review, conversation viewer), client components only where interactivity is required (approve/reject buttons, billing portal link)."*

---

## 6. Rollout Order Recommendation

Given you're doing this solo/small-team: build **Phase 0 (tenancy/auth/billing skeleton) and Phase 1–2 (LLM wiring + Action Graph)** first, and validate the whole loop against one real backend (e.g., globalconference.ca's API surface, if it has one, or a small internal test API) before investing in the multi-agent routing and approval-card UI. Those are the differentiators that make this "not existing in the industry," but they only matter once a tenant can sign up, connect a site, and get a working action-executing bot end to end — get that thin slice solid first, then layer in Billing/Technical/Sales specialization and the Product Signals feed.
