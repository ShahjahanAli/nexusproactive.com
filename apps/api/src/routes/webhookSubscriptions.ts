import { Router } from 'express';
import { z } from 'zod';
import { requireTenantAuth } from '../middleware/auth';
import {
  createWebhookSubscription,
  deleteWebhookSubscription,
  listWebhookSubscriptions,
  WebhookEvent,
} from '../services/webhooks';

const router = Router();

const eventEnum = z.enum([
  'conversation.started',
  'message.user',
  'message.assistant',
  'escalation.requested',
  'escalation.claimed',
  'escalation.resolved',
  'action.executed',
  'proactive.triggered',
]);

router.get('/', requireTenantAuth, async (req, res) => {
  const subscriptions = await listWebhookSubscriptions(req.tenantId!);
  res.json({ subscriptions });
});

router.post('/', requireTenantAuth, async (req, res) => {
  const schema = z.object({
    url: z.string().url(),
    events: z.array(eventEnum).min(1),
  });
  const body = schema.parse(req.body);
  const subscription = await createWebhookSubscription(
    req.tenantId!,
    body.url,
    body.events as WebhookEvent[],
  );
  res.status(201).json({ subscription });
});

router.delete('/:id', requireTenantAuth, async (req, res) => {
  const ok = await deleteWebhookSubscription(req.tenantId!, req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }
  res.json({ ok: true });
});

export default router;
