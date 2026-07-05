import { Router } from 'express';
import { z } from 'zod';
import { requireTenantAuth } from '../middleware/auth';
import {
  claimEscalation,
  listEscalations,
  replyAsHuman,
  resolveEscalation,
} from '../services/escalations';

const router = Router();

router.get('/', requireTenantAuth, async (req, res) => {
  const escalations = await listEscalations(req.tenantId!);
  res.json({ escalations });
});

router.post('/:conversationId/claim', requireTenantAuth, async (req, res) => {
  const ok = await claimEscalation(req.tenantId!, req.params.conversationId, req.userId!);
  if (!ok) {
    res.status(404).json({ error: 'Escalation not found' });
    return;
  }
  res.json({ ok: true });
});

router.post('/:conversationId/reply', requireTenantAuth, async (req, res) => {
  const schema = z.object({ message: z.string().min(1) });
  const { message } = schema.parse(req.body);
  const ok = await replyAsHuman(req.tenantId!, req.params.conversationId, req.userId!, message);
  if (!ok) {
    res.status(400).json({ error: 'Claim this chat before replying' });
    return;
  }
  res.json({ ok: true });
});

router.post('/:conversationId/resolve', requireTenantAuth, async (req, res) => {
  const schema = z.object({ resumeAi: z.boolean().optional() });
  const { resumeAi } = schema.parse(req.body);
  const ok = await resolveEscalation(req.tenantId!, req.params.conversationId, resumeAi ?? true);
  if (!ok) {
    res.status(404).json({ error: 'Escalation not found' });
    return;
  }
  res.json({ ok: true });
});

export default router;
