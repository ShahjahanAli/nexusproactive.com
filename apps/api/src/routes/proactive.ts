import { Router } from 'express';
import { z } from 'zod';
import { requireTenantAuth } from '../middleware/auth';
import { query } from '../db';
import {
  createProactiveTrigger,
  deleteProactiveTrigger,
  listProactiveTriggers,
} from '../services/proactive';

const router = Router();

async function assertSiteOwnership(tenantId: string, siteId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    'SELECT id FROM sites WHERE id = $1 AND tenant_id = $2',
    [siteId, tenantId],
  );
  return rows.length > 0;
}

router.get('/sites/:siteId/triggers', requireTenantAuth, async (req, res) => {
  if (!(await assertSiteOwnership(req.tenantId!, req.params.siteId))) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const triggers = await listProactiveTriggers(req.params.siteId);
  res.json({ triggers });
});

router.post('/sites/:siteId/triggers', requireTenantAuth, async (req, res) => {
  if (!(await assertSiteOwnership(req.tenantId!, req.params.siteId))) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }

  const schema = z.object({
    name: z.string().min(1),
    triggerType: z.enum(['page_view', 'idle', 'custom_event']),
    conditions: z.record(z.unknown()).default({}),
    messageTemplate: z.string().min(1),
  });
  const body = schema.parse(req.body);

  const trigger = await createProactiveTrigger(req.params.siteId, {
    name: body.name,
    triggerType: body.triggerType,
    conditions: body.conditions,
    messageTemplate: body.messageTemplate,
  });
  res.status(201).json({ trigger });
});

router.delete('/sites/:siteId/triggers/:triggerId', requireTenantAuth, async (req, res) => {
  if (!(await assertSiteOwnership(req.tenantId!, req.params.siteId))) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const ok = await deleteProactiveTrigger(req.params.siteId, req.params.triggerId);
  if (!ok) {
    res.status(404).json({ error: 'Trigger not found' });
    return;
  }
  res.json({ ok: true });
});

export default router;
