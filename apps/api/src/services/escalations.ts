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

export async function listEscalations(tenantId: string): Promise<EscalationRow[]> {
  return query<EscalationRow>(
    `SELECT c.id, c.site_id, s.name AS site_name, c.visitor_id, c.status,
            c.escalation_reason, c.escalated_at, c.assigned_to,
            tu.email AS assigned_email,
            (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id) AS message_count,
            (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id) AS last_message_at,
            c.created_at
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     LEFT JOIN tenant_users tu ON tu.id = c.assigned_to
     WHERE s.tenant_id = $1 AND c.status IN ('escalated', 'human')
     ORDER BY c.escalated_at DESC NULLS LAST`,
    [tenantId],
  );
}

export async function claimEscalation(
  tenantId: string,
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const conv = await queryOne<{ id: string }>(
    `SELECT c.id FROM conversations c
     JOIN sites s ON s.id = c.site_id
     WHERE c.id = $1 AND s.tenant_id = $2 AND c.status IN ('escalated', 'human')`,
    [conversationId, tenantId],
  );
  if (!conv) return false;

  await queryOne(
    `UPDATE conversations SET status = 'human', assigned_to = $1 WHERE id = $2`,
    [userId, conversationId],
  );

  await saveMessage(conversationId, 'system', 'A team member has joined the chat.');

  void dispatchWebhook(tenantId, 'escalation.claimed', { conversationId, userId });
  return true;
}

export async function replyAsHuman(
  tenantId: string,
  conversationId: string,
  userId: string,
  content: string,
): Promise<boolean> {
  const conv = await queryOne<{ id: string; status: string }>(
    `SELECT c.id, c.status FROM conversations c
     JOIN sites s ON s.id = c.site_id
     WHERE c.id = $1 AND s.tenant_id = $2`,
    [conversationId, tenantId],
  );
  if (!conv || conv.status !== 'human') return false;

  const user = await queryOne<{ email: string }>(
    'SELECT email FROM tenant_users WHERE id = $1',
    [userId],
  );

  await saveMessage(conversationId, 'assistant', content, user?.email ?? 'human');
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
