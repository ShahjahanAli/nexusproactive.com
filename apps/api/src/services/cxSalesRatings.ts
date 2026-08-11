import type {
  CxAgentRating,
  CxRatingPolicy,
  CxSalesEvent,
  CxSalesGoals,
} from '@nexus/shared-types';
import { query, queryOne } from '../db';
import { getTenantPlan } from './planLimits';
import type { ToolDefinition } from './llmClient';

export const RECORD_SALES_EVENT_TOOL = 'record_sales_event';
export const REQUEST_RATING_TOOL = 'request_rating';

export function recordSalesEventToolDefinition(): ToolDefinition {
  return {
    type: 'function',
    function: {
      name: RECORD_SALES_EVENT_TOOL,
      description:
        'Log a sales milestone for this CX Agent (lead interest, CTA clicked, demo booked, upgrade discussed). ' +
        'Call when a real sales-related outcome happens — not on every message.',
      parameters: {
        type: 'object',
        properties: {
          event_type: {
            type: 'string',
            description:
              'Short type such as lead_interest, cta_presented, demo_requested, upgrade_discussed, purchase_intent',
          },
          detail: {
            type: 'string',
            description: 'One-line note about what happened',
          },
        },
        required: ['event_type'],
      },
    },
  };
}

export function requestRatingToolDefinition(): ToolDefinition {
  return {
    type: 'function',
    function: {
      name: REQUEST_RATING_TOOL,
      description:
        'Ask the visitor to rate this CX Agent’s help (1–5 stars). Use once after you have meaningfully helped them. Do not ask mid-problem.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Optional internal reason (not shown to visitor)',
          },
        },
      },
    },
  };
}

export function formatSalesGoalsForPrompt(goals: CxSalesGoals | Record<string, unknown> | null | undefined): string {
  if (!goals || typeof goals !== 'object') return '';
  const g = goals as CxSalesGoals;
  const parts: string[] = ['## Sales goals'];
  if (g.pitch?.trim()) parts.push(`Pitch focus: ${g.pitch.trim()}`);
  if (g.products?.trim()) parts.push(`Products/services to highlight: ${g.products.trim()}`);
  if (g.cta?.trim()) parts.push(`Preferred CTA: ${g.cta.trim()}`);
  parts.push(
    g.soft === false
      ? 'Be direct about next steps when the visitor shows buying intent.'
      : 'Suggest next steps gently — never force a purchase.',
  );
  parts.push(
    `When a real sales milestone occurs, call **${RECORD_SALES_EVENT_TOOL}** once to log it.`,
  );
  return parts.length > 2 ? parts.join('\n') : '';
}

export function formatRatingPolicyForPrompt(
  policy: CxRatingPolicy | Record<string, unknown> | null | undefined,
): string {
  if (!policy || typeof policy !== 'object') return '';
  const p = policy as CxRatingPolicy;
  if (p.ask_after_resolve === false && !p.ask_after_messages) return '';
  return `## Ratings
After you have meaningfully resolved the visitor’s ask, you may call **${REQUEST_RATING_TOOL}** once.
Do not interrupt mid-problem. Prefer asking only once per conversation.`;
}

export async function recordSalesEvent(input: {
  tenantId: string;
  conversationId: string;
  cxAgentId: string;
  eventType: string;
  detail?: string;
  meta?: Record<string, unknown>;
}): Promise<CxSalesEvent> {
  const row = await queryOne<CxSalesEvent>(
    `INSERT INTO cx_sales_events (tenant_id, conversation_id, cx_agent_id, event_type, detail, meta)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      input.tenantId,
      input.conversationId,
      input.cxAgentId,
      input.eventType.trim().slice(0, 80) || 'sales_signal',
      input.detail?.trim().slice(0, 500) || null,
      JSON.stringify(input.meta ?? {}),
    ],
  );
  if (!row) throw new Error('Failed to record sales event');
  return row;
}

export async function listSalesEvents(opts: {
  tenantId: string;
  cxAgentId?: string;
  limit?: number;
}): Promise<CxSalesEvent[]> {
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 100);
  if (opts.cxAgentId) {
    return query<CxSalesEvent>(
      `SELECT * FROM cx_sales_events
       WHERE tenant_id = $1 AND cx_agent_id = $2
       ORDER BY created_at DESC LIMIT $3`,
      [opts.tenantId, opts.cxAgentId, limit],
    );
  }
  return query<CxSalesEvent>(
    `SELECT * FROM cx_sales_events WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [opts.tenantId, limit],
  );
}

export async function getConversationRating(
  conversationId: string,
): Promise<CxAgentRating | null> {
  return queryOne<CxAgentRating>(
    `SELECT * FROM cx_agent_ratings WHERE conversation_id = $1`,
    [conversationId],
  );
}

export async function submitCxRating(input: {
  tenantId: string;
  conversationId: string;
  cxAgentId: string;
  visitorId: string;
  score: number;
  comment?: string | null;
}): Promise<CxAgentRating> {
  const { limits } = await getTenantPlan(input.tenantId);
  if (limits.cx_ratings_enabled === false) {
    throw Object.assign(new Error('Ratings are not enabled on this plan'), {
      status: 403,
      code: 'RATINGS_DISABLED',
    });
  }

  const score = Math.max(1, Math.min(5, Math.round(input.score)));
  const row = await queryOne<CxAgentRating>(
    `INSERT INTO cx_agent_ratings
       (tenant_id, conversation_id, cx_agent_id, visitor_id, score, comment)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (conversation_id) DO UPDATE SET
       score = EXCLUDED.score,
       comment = EXCLUDED.comment
     RETURNING *`,
    [
      input.tenantId,
      input.conversationId,
      input.cxAgentId,
      input.visitorId,
      score,
      input.comment?.trim().slice(0, 1000) || null,
    ],
  );
  if (!row) throw new Error('Failed to save rating');
  return row;
}

export async function listCxRatings(opts: {
  tenantId: string;
  cxAgentId?: string;
  limit?: number;
}): Promise<CxAgentRating[]> {
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 100);
  if (opts.cxAgentId) {
    return query<CxAgentRating>(
      `SELECT * FROM cx_agent_ratings
       WHERE tenant_id = $1 AND cx_agent_id = $2
       ORDER BY created_at DESC LIMIT $3`,
      [opts.tenantId, opts.cxAgentId, limit],
    );
  }
  return query<CxAgentRating>(
    `SELECT * FROM cx_agent_ratings WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [opts.tenantId, limit],
  );
}

export async function shouldAskRating(opts: {
  tenantId: string;
  conversationId: string;
  cxAgentId: string;
  policy: CxRatingPolicy | Record<string, unknown> | null | undefined;
  assistantMessageCount: number;
  agentRequested: boolean;
}): Promise<boolean> {
  const { limits } = await getTenantPlan(opts.tenantId);
  if (limits.cx_ratings_enabled === false) return false;

  const existing = await getConversationRating(opts.conversationId);
  if (existing) return false;

  const policy = (opts.policy ?? {}) as CxRatingPolicy;
  if (opts.agentRequested) return true;

  const afterMessages =
    typeof policy.ask_after_messages === 'number' && policy.ask_after_messages > 0
      ? policy.ask_after_messages
      : null;
  if (afterMessages && opts.assistantMessageCount >= afterMessages) return true;

  // Default: ask after a meaningful exchange (2+ assistant replies) when ask_after_resolve is not false
  if (policy.ask_after_resolve === false) return false;
  return opts.assistantMessageCount >= 2;
}
