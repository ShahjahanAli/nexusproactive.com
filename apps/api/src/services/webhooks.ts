import crypto from 'crypto';
import { query } from '../db';

export type WebhookEvent =
  | 'conversation.started'
  | 'message.user'
  | 'message.assistant'
  | 'escalation.requested'
  | 'escalation.claimed'
  | 'escalation.resolved'
  | 'action.executed'
  | 'proactive.triggered';

export interface WebhookSubscription {
  id: string;
  tenant_id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function listWebhookSubscriptions(tenantId: string): Promise<WebhookSubscription[]> {
  return query<WebhookSubscription>(
    `SELECT id, tenant_id, url, secret, events, is_active, created_at
     FROM webhook_subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId],
  );
}

export async function createWebhookSubscription(
  tenantId: string,
  url: string,
  events: WebhookEvent[],
): Promise<WebhookSubscription> {
  const secret = generateWebhookSecret();
  const rows = await query<WebhookSubscription>(
    `INSERT INTO webhook_subscriptions (tenant_id, url, secret, events)
     VALUES ($1, $2, $3, $4)
     RETURNING id, tenant_id, url, secret, events, is_active, created_at`,
    [tenantId, url, secret, events],
  );
  return rows[0];
}

export async function deleteWebhookSubscription(
  tenantId: string,
  subscriptionId: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM webhook_subscriptions WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [subscriptionId, tenantId],
  );
  return rows.length > 0;
}

export async function dispatchWebhook(
  tenantId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const subs = await query<WebhookSubscription>(
    `SELECT * FROM webhook_subscriptions
     WHERE tenant_id = $1 AND is_active = true AND $2 = ANY(events)`,
    [tenantId, event],
  );

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      const signature = crypto
        .createHmac('sha256', sub.secret)
        .update(body)
        .digest('hex');

      await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Nexus-Event': event,
          'X-Nexus-Signature': `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
    }),
  );
}
