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
}

export async function listTenantConversations(
  tenantId: string,
  opts: {
    q?: string;
    siteId?: string;
    status?: string;
    activeAgent?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ conversations: ConversationListRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;
  const filters: unknown[] = [tenantId];
  const conds: string[] = ['s.tenant_id = $1'];

  if (opts.siteId) {
    filters.push(opts.siteId);
    conds.push(`c.site_id = $${filters.length}`);
  }
  if (opts.status) {
    filters.push(opts.status);
    conds.push(`c.status = $${filters.length}`);
  }
  if (opts.activeAgent) {
    filters.push(opts.activeAgent);
    conds.push(`c.active_agent = $${filters.length}`);
  }
  if (opts.q) {
    filters.push(`%${opts.q}%`);
    conds.push(`c.visitor_id ILIKE $${filters.length}`);
  }

  const where = conds.join(' AND ');

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     WHERE ${where}`,
    filters,
  );

  const conversations = await query<ConversationListRow>(
    `SELECT c.id, c.site_id, c.visitor_id, c.status, c.active_agent, c.created_at,
            c.tokens_used,
            s.name AS site_name,
            (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id) AS message_count
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     WHERE ${where}
     ORDER BY c.created_at DESC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset],
  );

  return {
    conversations,
    total: parseInt(countRow?.count ?? '0', 10),
  };
}
