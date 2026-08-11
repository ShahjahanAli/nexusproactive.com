import { query, queryOne } from '../db';

export interface ConversationListRow {
  id: string;
  site_id: string;
  visitor_id: string;
  status: string;
  active_agent: string;
  created_at: string;
  tokens_used: number;
  site_name: string;
  message_count: number;
  /** Timestamp of the newest message, for "last activity". */
  last_message_at: string | null;
  detected_language: string | null;
  escalated_at: string | null;
  cx_agent_name: string | null;
  assigned_agent: string | null;
  rating_score: number | null;
  /** First visitor message, for a readable list preview. */
  preview: string | null;
}

export interface ConversationStats {
  total: number;
  open: number;
  escalated: number;
  human: number;
  closed: number;
  messages: number;
  tokens: number;
  today: number;
  avg_messages: number;
  avg_rating: number | null;
  rated: number;
}

interface Filters {
  q?: string;
  siteId?: string;
  status?: string;
  activeAgent?: string;
}

/** Shared WHERE builder so list rows and stats always describe the same set. */
function buildWhere(tenantId: string, opts: Filters) {
  const params: unknown[] = [tenantId];
  const conds: string[] = ['s.tenant_id = $1'];

  if (opts.siteId) {
    params.push(opts.siteId);
    conds.push(`c.site_id = $${params.length}`);
  }
  if (opts.status) {
    params.push(opts.status);
    conds.push(`c.status = $${params.length}`);
  }
  if (opts.activeAgent) {
    params.push(opts.activeAgent);
    conds.push(`c.active_agent = $${params.length}`);
  }
  if (opts.q) {
    params.push(`%${opts.q}%`);
    conds.push(`c.visitor_id ILIKE $${params.length}`);
  }

  return { where: conds.join(' AND '), params };
}

export async function listTenantConversations(
  tenantId: string,
  opts: Filters & { limit?: number; offset?: number } = {},
): Promise<{ conversations: ConversationListRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;
  const { where, params } = buildWhere(tenantId, opts);

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     WHERE ${where}`,
    params,
  );

  const conversations = await query<ConversationListRow>(
    `SELECT c.id, c.site_id, c.visitor_id, c.status, c.active_agent, c.created_at,
            c.tokens_used, c.detected_language, c.escalated_at,
            s.name AS site_name,
            (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id) AS message_count,
            (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS last_message_at,
            (SELECT m.content FROM messages m
              WHERE m.conversation_id = c.id AND m.role = 'user'
              ORDER BY m.created_at ASC LIMIT 1) AS preview,
            a.display_name AS cx_agent_name,
            COALESCE(u.display_name, u.email) AS assigned_agent,
            r.score AS rating_score
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     LEFT JOIN cx_agents a ON a.id = c.cx_agent_id
     LEFT JOIN tenant_users u ON u.id = c.assigned_to
     LEFT JOIN cx_agent_ratings r ON r.conversation_id = c.id
     WHERE ${where}
     ORDER BY COALESCE(
       (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id),
       c.created_at
     ) DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return {
    conversations,
    total: parseInt(countRow?.count ?? '0', 10),
  };
}

export async function getTenantConversationStats(
  tenantId: string,
  opts: Filters = {},
): Promise<ConversationStats> {
  const { where, params } = buildWhere(tenantId, opts);

  const row = await queryOne<{
    total: string;
    open: string;
    escalated: string;
    human: string;
    closed: string;
    messages: string;
    tokens: string;
    today: string;
    rated: string;
    avg_rating: string | null;
  }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE c.status = 'open')::text AS open,
       COUNT(*) FILTER (WHERE c.status = 'escalated')::text AS escalated,
       COUNT(*) FILTER (WHERE c.status = 'human')::text AS human,
       COUNT(*) FILTER (WHERE c.status = 'closed')::text AS closed,
       COALESCE(SUM(
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id)
       ), 0)::text AS messages,
       COALESCE(SUM(c.tokens_used), 0)::text AS tokens,
       COUNT(*) FILTER (WHERE c.created_at >= date_trunc('day', now()))::text AS today,
       COUNT(r.id)::text AS rated,
       AVG(r.score)::text AS avg_rating
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     LEFT JOIN cx_agent_ratings r ON r.conversation_id = c.id
     WHERE ${where}`,
    params,
  );

  const total = parseInt(row?.total ?? '0', 10);
  const messages = parseInt(row?.messages ?? '0', 10);

  return {
    total,
    open: parseInt(row?.open ?? '0', 10),
    escalated: parseInt(row?.escalated ?? '0', 10),
    human: parseInt(row?.human ?? '0', 10),
    closed: parseInt(row?.closed ?? '0', 10),
    messages,
    tokens: parseInt(row?.tokens ?? '0', 10),
    today: parseInt(row?.today ?? '0', 10),
    avg_messages: total > 0 ? Math.round((messages / total) * 10) / 10 : 0,
    rated: parseInt(row?.rated ?? '0', 10),
    avg_rating: row?.avg_rating ? Math.round(Number(row.avg_rating) * 10) / 10 : null,
  };
}

export interface ConversationDetail {
  id: string;
  site_id: string;
  site_name: string;
  visitor_id: string;
  status: string;
  active_agent: string;
  created_at: string;
  escalated_at: string | null;
  tokens_used: number;
  detected_language: string | null;
  handoff_brief: string | null;
  cx_agent_id: string | null;
  cx_agent_name: string | null;
  assigned_agent: string | null;
  rating_score: number | null;
  rating_comment: string | null;
  message_count: number;
  visitor_messages: number;
  agent_messages: number;
  last_message_at: string | null;
  consults: number;
  sales_events: number;
}

export async function getConversationDetail(
  tenantId: string,
  conversationId: string,
): Promise<ConversationDetail | null> {
  return queryOne<ConversationDetail>(
    `SELECT c.id, c.site_id, c.visitor_id, c.status, c.active_agent, c.created_at,
            c.escalated_at, c.tokens_used, c.detected_language, c.handoff_brief,
            c.cx_agent_id,
            s.name AS site_name,
            a.display_name AS cx_agent_name,
            COALESCE(u.display_name, u.email) AS assigned_agent,
            r.score AS rating_score,
            r.comment AS rating_comment,
            (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id) AS message_count,
            (SELECT COUNT(*)::int FROM messages m
              WHERE m.conversation_id = c.id AND m.role = 'user') AS visitor_messages,
            (SELECT COUNT(*)::int FROM messages m
              WHERE m.conversation_id = c.id AND m.role = 'assistant') AS agent_messages,
            (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS last_message_at,
            (SELECT COUNT(*)::int FROM cx_consults k WHERE k.conversation_id = c.id) AS consults,
            (SELECT COUNT(*)::int FROM cx_sales_events e WHERE e.conversation_id = c.id) AS sales_events
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     LEFT JOIN cx_agents a ON a.id = c.cx_agent_id
     LEFT JOIN tenant_users u ON u.id = c.assigned_to
     LEFT JOIN cx_agent_ratings r ON r.conversation_id = c.id
     WHERE c.id = $1 AND s.tenant_id = $2`,
    [conversationId, tenantId],
  );
}
