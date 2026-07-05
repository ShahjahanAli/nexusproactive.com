import { query, queryOne } from '../db';
import { getConversationMessages } from './conversationService';

export async function getWidgetConversationHistory(
  siteId: string,
  visitorId: string,
  conversationId: string,
): Promise<{ conversationId: string; messages: Array<{ role: string; content: string }> } | null> {
  const conv = await queryOne<{ id: string }>(
    `SELECT c.id FROM conversations c
     WHERE c.id = $1 AND c.site_id = $2 AND c.visitor_id = $3`,
    [conversationId, siteId, visitorId],
  );
  if (!conv) return null;

  const rows = await getConversationMessages(conversationId);
  const messages = rows
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
    .map((m) => ({ role: m.role, content: m.content ?? '' }));

  return { conversationId, messages };
}

export interface VisitorSummary {
  visitor_id: string;
  conversations: number;
  messages: number;
  tokens_used: number;
  sites: string[];
  first_seen: string;
  last_seen: string;
}

export async function getTenantVisitors(
  tenantId: string,
  limit = 100,
): Promise<VisitorSummary[]> {
  return query<VisitorSummary>(
    `SELECT c.visitor_id,
            COUNT(DISTINCT c.id)::int AS conversations,
            COUNT(m.id)::int AS messages,
            COALESCE(SUM(c.tokens_used), 0)::int AS tokens_used,
            ARRAY_AGG(DISTINCT s.name) AS sites,
            MIN(c.created_at) AS first_seen,
            MAX(GREATEST(c.created_at, COALESCE(
              (SELECT MAX(m2.created_at) FROM messages m2 WHERE m2.conversation_id = c.id),
              c.created_at
            ))) AS last_seen
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     LEFT JOIN messages m ON m.conversation_id = c.id
     WHERE s.tenant_id = $1
     GROUP BY c.visitor_id
     ORDER BY last_seen DESC
     LIMIT $2`,
    [tenantId, limit],
  );
}

export interface VisitorConversation {
  id: string;
  site_id: string;
  site_name: string;
  active_agent: string;
  status: string;
  message_count: number;
  tokens_used: number;
  created_at: string;
  last_message_at: string | null;
}

export async function getVisitorProfile(
  tenantId: string,
  visitorId: string,
): Promise<{
  visitor_id: string;
  totals: { conversations: number; messages: number; tokens_used: number };
  conversations: VisitorConversation[];
} | null> {
  const totals = await queryOne<{
    conversations: number;
    messages: number;
    tokens_used: number;
  }>(
    `SELECT COUNT(DISTINCT c.id)::int AS conversations,
            COUNT(m.id)::int AS messages,
            COALESCE(SUM(c.tokens_used), 0)::int AS tokens_used
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     LEFT JOIN messages m ON m.conversation_id = c.id
     WHERE s.tenant_id = $1 AND c.visitor_id = $2`,
    [tenantId, visitorId],
  );

  if (!totals || totals.conversations === 0) return null;

  const conversations = await query<VisitorConversation>(
    `SELECT c.id, c.site_id, s.name AS site_name, c.active_agent, c.status,
            (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id) AS message_count,
            c.tokens_used, c.created_at,
            (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS last_message_at
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     WHERE s.tenant_id = $1 AND c.visitor_id = $2
     ORDER BY c.created_at DESC`,
    [tenantId, visitorId],
  );

  return {
    visitor_id: visitorId,
    totals,
    conversations,
  };
}
