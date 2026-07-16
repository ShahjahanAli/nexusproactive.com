import { Router } from 'express';
import { z } from 'zod';
import { TenantRole } from '@nexus/shared-types';
import { requireTenantAuth } from '../middleware/auth';
import { checkPlanLimit, getCurrentUsage, getTenantPlan } from '../services/planLimits';
import { createBillingPortalSession } from '../services/stripeService';
import { getTenantAnalytics } from '../services/analytics';
import { listRecentActionOps } from '../services/actionOps';
import {
  createTenantAgent,
  listTenantTeam,
  removeTenantAgent,
  updateTenantAgent,
} from '../services/tenantTeam';

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

router.get('/action-ops', requireTenantAuth, async (req, res) => {
  const ops = await listRecentActionOps(req.tenantId!);
  res.json({ ops });
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

router.get('/team', requireTenantAuth, async (req, res) => {
  const members = await listTenantTeam(req.tenantId!);
  res.json({ members });
});

router.post('/team', requireTenantAuth, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['admin', 'agent', 'viewer']).optional(),
    displayName: z.string().max(120).optional(),
  });
  const body = schema.parse(req.body);
  const member = await createTenantAgent({
    tenantId: req.tenantId!,
    actorRole: (req.auth?.role ?? 'viewer') as TenantRole,
    email: body.email,
    password: body.password,
    role: body.role as TenantRole | undefined,
    displayName: body.displayName,
  });
  res.status(201).json({ member });
});

router.patch('/team/:userId', requireTenantAuth, async (req, res) => {
  const schema = z.object({
    role: z.enum(['admin', 'agent', 'viewer']).optional(),
    displayName: z.string().max(120).nullable().optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).optional(),
  });
  const body = schema.parse(req.body);
  const member = await updateTenantAgent({
    tenantId: req.tenantId!,
    actorUserId: req.userId!,
    actorRole: (req.auth?.role ?? 'viewer') as TenantRole,
    userId: req.params.userId,
    role: body.role as TenantRole | undefined,
    displayName: body.displayName,
    isActive: body.isActive,
    password: body.password,
  });
  res.json({ member });
});

router.delete('/team/:userId', requireTenantAuth, async (req, res) => {
  await removeTenantAgent({
    tenantId: req.tenantId!,
    actorRole: (req.auth?.role ?? 'viewer') as TenantRole,
    userId: req.params.userId,
  });
  res.json({ ok: true });
});

export default router;
