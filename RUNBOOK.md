# Nexus Widget — Operations Runbook

## New tenant onboarding

1. Customer signs up at `/signup` → lands in `/app/onboarding`
2. Connect site: domain, backend URL, OpenAPI spec URL
3. Action Graph ingests automatically; review actions at `/app/sites/[id]`
4. Copy embed snippet and add to their website:
   ```html
   <script>window.NEXUS_API_URL='https://api.yourdomain.com';</script>
   <script src="https://cdn.yourdomain.com/nexus.js" defer></script>
   <nexus-chat site-id="SITE_UUID"></nexus-chat>
   ```

## Rotate JWT signing secret

1. Generate new secret: `openssl rand -hex 32`
2. Update `sites.jwt_signing_secret` for the site in DB (encrypt at rest in production)
3. Deploy updated secret to client's backend middleware config
4. Old scoped tokens expire within 15 minutes — no hard cutover needed

## Force Action Graph re-ingest

```bash
curl -X POST http://localhost:5000/sites/SITE_ID/ingest \
  -H "Authorization: Bearer TENANT_JWT" \
  -H "Content-Type: application/json" \
  -d '{"specUrl":"https://api.example.com/openapi.json"}'
```

Or wait for nightly cron (`ACTION_GRAPH_CRON`, default 3am).

## Manually undo a stuck action

```bash
curl -X POST http://localhost:5000/v1/chat/undo/EXECUTION_UUID
```

Check `action_executions` table for status and `undo_deadline`.

## Stripe webhook replay

1. Stripe Dashboard → Developers → Webhooks → select endpoint
2. Find failed event → **Resend**
3. Verify `tenants.plan` and `plan_limits` updated in DB
4. Idempotent: webhook handler upserts by `tenant_id` from metadata

## Database migrations

```bash
npm run db:migrate          # run pending
npm run db:migrate:status   # check status
npm run db:rollback         # rollback last batch
```

## Health checks

- API: `GET /health` — expects `db: true`, `redis: true|disabled`
- LLM: send test message to `POST /v1/chat`

## Dev mock backend (Phase 4 testing)

When `NODE_ENV !== production`:

- `GET /dev/mock/orders/:id`
- `PATCH /dev/mock/users/:id/email`
- `POST /dev/mock/orders/:id/cancel`

Point site `backend_base_url` to `http://localhost:5000/dev/mock`.
