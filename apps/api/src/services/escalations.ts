import { query, queryOne } from '../db';
import { saveMessage } from './conversationService';
import { dispatchWebhook } from './webhooks';
import { getSiteTenantId } from './conversationService';

export interface EscalationRow {
  id: string;
  site_id: string;
  site_name: string;
  visitor_id: string;
  status: string;
  escalation_reason: string | null;
  escalated_at: string | null;
  assigned_to: string | null;
  assigned_email: string | null;
  message_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
}

export async function requestEscalation(
  siteId: string,
  visitorId: string,
  conversationId: string,
  reason?: string,
): Promise<{ ok: boolean; message?: string }> {
  const conv = await queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM conversations
     WHERE id = $1 AND site_id = $2 AND visitor_id = $3`,
    [conversationId, siteId, visitorId],
  );
  if (!conv) return { ok: false, message: 'Conversation not found' };

  if (conv.status === 'escalated' || conv.status === 'human') {
    return { ok: true, message: 'Already escalated' };
  }

  await queryOne(
    `UPDATE conversations
     SET status = 'escalated', escalated_at = now(), escalation_reason = $1
     WHERE id = $2`,
    [reason ?? null, conversationId],
  );

  await saveMessage(
    conversationId,
    'system',
    'A team member has been notified. Someone will join this chat shortly.',
  );

  const tenantId = await getSiteTenantId(siteId);
  if (tenantId) {
    void dispatchWebhook(tenantId, 'escalation.requested', {
      conversationId,
      siteId,
      visitorId,
      reason: reason ?? null,
    });
  }

  return { ok: true };
}

export async function listEscalations(
  tenantId: string,
  opts: {
    q?: string;
    siteId?: string;
    status?: 'escalated' | 'human' | 'open';
    assigned?: 'mine' | 'unassigned' | 'any';
    userId?: string;
    /** Include active AI chats (status=open) alongside escalations — for Live chats dock */
    includeOpen?: boolean;
    /** Only threads with activity in the last N hours (default 72 when includeOpen) */
    activeWithinHours?: number;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ escalations: EscalationRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;
  const filters: unknown[] = [tenantId];
  const conds: string[] = ['s.tenant_id = $1'];

  if (opts.status) {
    filters.push(opts.status);
    conds.push(`c.status = $${filters.length}`);
  } else if (opts.includeOpen) {
    conds.push(`c.status IN ('open', 'escalated', 'human')`);
  } else {
    conds.push(`c.status IN ('escalated', 'human')`);
  }

  if (opts.siteId) {
    filters.push(opts.siteId);
    conds.push(`c.site_id = $${filters.length}`);
  }
  if (opts.q) {
    filters.push(`%${opts.q}%`);
    conds.push(`c.visitor_id ILIKE $${filters.length}`);
  }
  if (opts.assigned === 'mine' && opts.userId) {
    filters.push(opts.userId);
    conds.push(`c.assigned_to = $${filters.length}`);
  } else if (opts.assigned === 'unassigned') {
    conds.push('c.assigned_to IS NULL');
  }

  const activeHours = opts.activeWithinHours ?? (opts.includeOpen ? 72 : undefined);
  if (activeHours) {
    filters.push(activeHours);
    conds.push(`COALESCE(
      (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id),
      c.escalated_at,
      c.created_at
    ) > now() - ($${filters.length}::text || ' hours')::interval`);
  }

  const where = conds.join(' AND ');

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     WHERE ${where}`,
    filters,
  );

  const escalations = await query<EscalationRow>(
    `SELECT c.id, c.site_id, s.name AS site_name, c.visitor_id, c.status,
            c.escalation_reason, c.escalated_at, c.assigned_to,
            tu.email AS assigned_email,
            (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id) AS message_count,
            (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS last_message_at,
            (SELECT LEFT(m.content, 120) FROM messages m
              WHERE m.conversation_id = c.id AND m.role IN ('user', 'assistant', 'system')
              ORDER BY m.created_at DESC LIMIT 1) AS last_message_preview,
            c.created_at
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     LEFT JOIN tenant_users tu ON tu.id = c.assigned_to
     WHERE ${where}
     ORDER BY COALESCE(
       (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id),
       c.escalated_at,
       c.created_at
     ) DESC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset],
  );

  return {
    escalations,
    total: parseInt(countRow?.count ?? '0', 10),
  };
}

export async function claimEscalation(
  tenantId: string,
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const conv = await queryOne<{ id: string; assigned_to: string | null; status: string }>(
    `SELECT c.id, c.assigned_to, c.status FROM conversations c
     JOIN sites s ON s.id = c.site_id
     WHERE c.id = $1 AND s.tenant_id = $2 AND c.status IN ('escalated', 'human', 'open')`,
    [conversationId, tenantId],
  );
  if (!conv) return false;

  const switching = conv.assigned_to !== userId;
  await queryOne(
    `UPDATE conversations SET status = 'human', assigned_to = $1,
       escalated_at = COALESCE(escalated_at, now())
     WHERE id = $2`,
    [userId, conversationId],
  );

  if (switching) {
    await saveMessage(conversationId, 'system', 'A team member has joined the chat.');
  }

  void dispatchWebhook(tenantId, 'escalation.claimed', { conversationId, userId });
  return true;
}

export async function replyAsHuman(
  tenantId: string,
  conversationId: string,
  userId: string,
  content: string,
): Promise<boolean> {
  const conv = await queryOne<{ id: string; status: string; assigned_to: string | null }>(
    `SELECT c.id, c.status, c.assigned_to FROM conversations c
     JOIN sites s ON s.id = c.site_id
     WHERE c.id = $1 AND s.tenant_id = $2`,
    [conversationId, tenantId],
  );
  if (!conv) return false;

  // Any agent can jump into a waiting/open/human thread
  if (conv.status === 'escalated' || conv.status === 'open' || conv.assigned_to !== userId) {
    const ok = await claimEscalation(tenantId, conversationId, userId);
    if (!ok) return false;
  } else if (conv.status !== 'human') {
    return false;
  }

  const user = await queryOne<{ email: string; display_name: string | null }>(
    'SELECT email, display_name FROM tenant_users WHERE id = $1',
    [userId],
  );

  const agentLabel = user?.display_name?.trim() || user?.email || 'human';
  await saveMessage(conversationId, 'assistant', content, agentLabel);
  return true;
}

export async function resolveEscalation(
  tenantId: string,
  conversationId: string,
  resumeAi = true,
): Promise<boolean> {
  const conv = await queryOne<{ id: string }>(
    `SELECT c.id FROM conversations c
     JOIN sites s ON s.id = c.site_id
     WHERE c.id = $1 AND s.tenant_id = $2`,
    [conversationId, tenantId],
  );
  if (!conv) return false;

  const newStatus = resumeAi ? 'open' : 'closed';
  await queryOne(
    `UPDATE conversations
     SET status = $1, assigned_to = NULL, escalated_at = NULL, escalation_reason = NULL
     WHERE id = $2`,
    [newStatus, conversationId],
  );

  await saveMessage(
    conversationId,
    'system',
    resumeAi
      ? 'This chat is back with the AI assistant. How can I help?'
      : 'This conversation has been closed. Thank you!',
  );

  void dispatchWebhook(tenantId, 'escalation.resolved', { conversationId, resumeAi });
  return true;
}

export function isHumanHandled(status: string): boolean {
  return status === 'escalated' || status === 'human';
}
