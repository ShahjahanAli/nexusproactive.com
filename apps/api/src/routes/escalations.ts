import { Router } from 'express';
import { z } from 'zod';
import { requireTenantAuth } from '../middleware/auth';
import { parseOptionalString, parsePageLimit } from '../lib/listQuery';
import {
  claimEscalation,
  listEscalations,
  replyAsHuman,
  resolveEscalation,
} from '../services/escalations';

const router = Router();

router.get('/', requireTenantAuth, async (req, res) => {
  const { limit, offset } = parsePageLimit(req.query);
  const q = parseOptionalString(req.query.q);
  const siteId = parseOptionalString(req.query.siteId);
  const status = parseOptionalString(req.query.status) as
    | 'escalated'
    | 'human'
    | 'open'
    | undefined;
  const assigned = parseOptionalString(req.query.assigned) as
    | 'mine'
    | 'unassigned'
    | 'any'
    | undefined;
  const includeOpen =
    req.query.includeOpen === '1' ||
    req.query.includeOpen === 'true' ||
    req.query.live === '1' ||
    req.query.live === 'true';

  const result = await listEscalations(req.tenantId!, {
    q,
    siteId,
    status,
    assigned: assigned ?? 'any',
    userId: req.userId,
    includeOpen,
    limit,
    offset,
  });
  res.json({ ...result, limit, offset });
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
    res.status(400).json({ error: 'Unable to join this chat' });
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
