import { Router } from 'express';
import { z } from 'zod';
import { requireTenantAuth } from '../middleware/auth';
import { checkPlanLimit, getCurrentUsage, getTenantPlan } from '../services/planLimits';
import { createBillingPortalSession } from '../services/stripeService';
import { getTenantAnalytics } from '../services/analytics';

const router = Router();

router.get('/plan', requireTenantAuth, async (req, res) => {
  const { plan, limits } = await getTenantPlan(req.tenantId!);
  const usage = await getCurrentUsage(req.tenantId!);
  res.json({ plan, limits, usage });
});

router.get('/analytics', requireTenantAuth, async (req, res) => {
  const analytics = await getTenantAnalytics(req.tenantId!);
  res.json(analytics);
});

router.get('/limits/:metric', requireTenantAuth, async (req, res) => {
  const metricSchema = z.enum([
    'max_sites',
    'max_conversations_month',
    'max_tokens_month',
  ]);
  const metric = metricSchema.parse(req.params.metric);
  const result = await checkPlanLimit(req.tenantId!, metric);
  res.json(result);
});

router.post('/portal', requireTenantAuth, async (req, res) => {
  const url = await createBillingPortalSession(req.tenantId!);
  res.json({ url });
});

export default router;
