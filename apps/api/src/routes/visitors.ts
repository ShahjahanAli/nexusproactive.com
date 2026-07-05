import { Router } from 'express';
import { z } from 'zod';
import { requireTenantAuth } from '../middleware/auth';
import { getTenantVisitors, getVisitorProfile } from '../services/visitors';
import { addVisitorMemory, getVisitorMemories } from '../services/visitorMemory';

const router = Router();

router.get('/', requireTenantAuth, async (req, res) => {
  const visitors = await getTenantVisitors(req.tenantId!);
  res.json({ visitors });
});

router.get('/:visitorId', requireTenantAuth, async (req, res) => {
  const profile = await getVisitorProfile(req.tenantId!, req.params.visitorId);
  if (!profile) {
    res.status(404).json({ error: 'Visitor not found' });
    return;
  }
  res.json(profile);
});

router.get('/:visitorId/memories', requireTenantAuth, async (req, res) => {
  const siteRows = await getVisitorProfile(req.tenantId!, req.params.visitorId);
  if (!siteRows) {
    res.status(404).json({ error: 'Visitor not found' });
    return;
  }
  const siteId = siteRows.conversations[0]?.site_id;
  if (!siteId) {
    res.json({ memories: [] });
    return;
  }
  const memories = await getVisitorMemories(siteId, req.params.visitorId);
  res.json({ memories });
});

router.post('/:visitorId/memories', requireTenantAuth, async (req, res) => {
  const schema = z.object({
    siteId: z.string().uuid(),
    fact: z.string().min(1),
    category: z.string().optional(),
  });
  const body = schema.parse(req.body);
  const memory = await addVisitorMemory(
    body.siteId,
    req.params.visitorId,
    body.fact,
    body.category ?? 'general',
    'human',
  );
  res.status(201).json({ memory });
});

export default router;
