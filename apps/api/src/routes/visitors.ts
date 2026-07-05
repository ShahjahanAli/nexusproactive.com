import { Router } from 'express';
import { requireTenantAuth } from '../middleware/auth';
import { getTenantVisitors, getVisitorProfile } from '../services/visitors';

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

export default router;
