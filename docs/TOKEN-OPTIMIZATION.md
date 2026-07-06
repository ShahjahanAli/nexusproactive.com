# Token optimization guide

Nexus chat can consume many tokens on data-heavy sites (large OpenAPI responses, long conversations, tool loops). This document explains **what burns tokens**, **what we already optimize**, and **what to configure next**.

## Where tokens go (typical session)

| Stage | Cost driver |
|-------|-------------|
| **Router** | One small LLM call per message (agent routing) |
| **System prompt** | Site name, tool catalog (every API action listed), contact rules, memories |
| **Chat history** | Every prior user + assistant message resent each turn |
| **Tool loop** | 1–5 `chatCompletion` calls with full context + tool schemas |
| **API tool results** | Full JSON from your backend (e.g. 100KB conference list) injected as `tool` messages |
| **Final stream** | Another full-context `streamChat` pass for the visible reply |

A single user question can therefore hit the LLM **2–7 times** with a growing prompt.

---

## Built-in optimizations (implemented)

| Optimization | Default | Effect |
|--------------|---------|--------|
| **History window** | Last 16 messages | Older turns dropped from LLM context |
| **Tool result truncation** | 6,000 chars | Large API JSON trimmed; arrays capped at 6 items |
| **Compact tool catalog** | When > 8 actions | Shorter system prompt (path only, no long descriptions) |
| **Small-talk skip** | Greetings | Router may skip forced tool call |
| **List cap in prompt** | 6 items | AI instructed not to dump full API lists in replies |

Constants live in `apps/api/src/services/tokenOptimization.ts`.

---

## Configuration recommendations

### 1. OpenAPI / actions (highest impact)

- **Activate only needed actions** — deactivate unused endpoints in Deployments → Actions.
- **Prefer filtered API endpoints** — e.g. `search?status=upcoming&limit=10` instead of returning entire catalog.
- **Add pagination params** to OpenAPI so the AI passes `limit`, `page`, `month`, etc.

### 2. Model choice

- Use a **smaller/faster model** for routing (`LLM_DEFAULT_MODEL`) if quality allows.
- Reserve larger models for complex multi-step flows only (future: per-agent models).

### 3. Conversation guardrails

- Set **max user messages per chat** (Widget settings) to limit long AI sessions before human/WhatsApp handoff.
- Shorter AI phases = fewer cumulative tokens.

### 4. Visitor contact collection

- Once contact is saved, the AI **stops re-asking** — smaller prompts and fewer clarification turns.

### 5. Monitor usage

- **Analytics** and **Billing** in the dashboard show tokens per tenant.
- **Visitor profile** shows tokens per conversation — spot expensive threads.

---

## Roadmap (not yet implemented)

| Idea | Benefit |
|------|---------|
| **Conversation summary** | Replace old messages with a short summary block |
| **Single LLM pass** | Stream from tool-calling completion (skip second `streamChat`) |
| **Semantic action search** | Send only 5–10 relevant tools instead of full catalog |
| **Response caching** | Cache identical read-only API results (Redis) |
| **Cheaper router model** | `LLM_ROUTER_MODEL` env separate from main model |
| **Token budget per message** | Hard cap with graceful “let me connect you to a human” |

---

## Quick wins checklist for operators

1. Deactivate unused OpenAPI actions in dashboard.
2. Ensure backend APIs support **limit/filter** query params.
3. Set `maxUserMessages` on widget (e.g. 15–20).
4. Use a cost-efficient default model in `.env`.
5. Watch `tokens_used` on long conversations in Visitors.
6. Subscribe webhooks to `lead.updated` instead of logging every message externally.

---

## Environment variables

```env
LLM_DEFAULT_MODEL=gpt-4o-mini          # cheaper default
LLM_FALLBACK_MODEL=gpt-4o                # optional escalation model
```

Tune `MAX_LLM_HISTORY_MESSAGES` and `TOOL_RESULT_MAX_CHARS` in code if you need stricter limits for your deployment.
