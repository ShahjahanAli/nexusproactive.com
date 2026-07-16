import { Router } from 'express';
import { z } from 'zod';
import {
  getPlatformAdmin,
  listPlatformAdmins,
  platformLogin,
} from '../services/platformAuthService';
import {
  getOverviewStats,
  getTenantDetail,
  listAuditLog,
  listFeatureFlags,
  listPlans,
  listSettings,
  listTenants,
  setTenantFeatureOverride,
  syncPlanLimitsToTenants,
  updateFeatureFlag,
  updatePlan,
  updateSetting,
  updateTenant,
  writeAuditLog,
} from '../services/platformService';
import {
  createOpenApiSourceType,
  deleteOpenApiSourceType,
  listOpenApiSourceTypes,
  updateOpenApiSourceType,
} from '../services/openapiSources';
import {
  clearPlatformAuthCookie,
  requirePlatformAuth,
  requirePlatformRole,
  requirePlatformWrite,
  setPlatformAuthCookie,
} from '../middleware/platformAuth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/auth/login', async (req, res) => {
  const body = loginSchema.parse(req.body);
  const { token, user } = await platformLogin(body.email, body.password);
  setPlatformAuthCookie(res, token);
  await writeAuditLog({
    actorId: user.adminId,
    actorEmail: user.email,
    action: 'platform.login',
    targetType: 'platform_admin',
    targetId: user.adminId,
  });
  res.json({ token, user });
});

router.post('/auth/logout', (_req, res) => {
  clearPlatformAuthCookie(res);
  res.json({ ok: true });
});

router.get('/auth/me', requirePlatformAuth, async (req, res) => {
  const user = await getPlatformAdmin(req.adminId!);
  if (!user) {
    throw new AppError('Admin not found', 401, 'UNAUTHORIZED');
  }
  req.platformAuth = user;
  res.json({ user });
});

router.use(requirePlatformAuth);

router.get('/overview', async (_req, res) => {
  const stats = await getOverviewStats();
  res.json({ stats });
});

router.get('/tenants', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const plan = typeof req.query.plan === 'string' ? (req.query.plan as 'trial') : undefined;
  const status =
    typeof req.query.status === 'string'
      ? (req.query.status as 'active' | 'suspended' | 'churned')
      : undefined;
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
  const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
  const result = await listTenants({ q, plan, status, limit, offset });
  res.json(result);
});

router.get('/tenants/:id', async (req, res) => {
  const detail = await getTenantDetail(req.params.id);
  res.json(detail);
});

const tenantPatchSchema = z.object({
  plan: z.enum(['trial', 'starter', 'growth', 'scale']).optional(),
  plan_limits: z
    .object({
      max_sites: z.number().int().positive(),
      max_conversations_month: z.number().int().positive(),
      max_tokens_month: z.number().int().positive(),
    })
    .optional(),
  status: z.enum(['active', 'suspended', 'churned']).optional(),
  notes: z.string().nullable().optional(),
});

router.patch('/tenants/:id', requirePlatformWrite, async (req, res) => {
  const patch = tenantPatchSchema.parse(req.body);
  const tenant = await updateTenant(req.params.id, patch);
  await writeAuditLog({
    actorId: req.platformAuth!.adminId,
    actorEmail: req.platformAuth!.email,
    action: 'tenant.update',
    targetType: 'tenant',
    targetId: req.params.id,
    meta: patch,
  });
  res.json({ tenant });
});

const featureOverrideSchema = z.object({
  enabled: z.boolean().nullable(),
});

router.put(
  '/tenants/:id/features/:key',
  requirePlatformWrite,
  async (req, res) => {
    const body = featureOverrideSchema.parse(req.body);
    await setTenantFeatureOverride(req.params.id, req.params.key, body.enabled);
    await writeAuditLog({
      actorId: req.platformAuth!.adminId,
      actorEmail: req.platformAuth!.email,
      action: 'tenant.feature_override',
      targetType: 'tenant',
      targetId: req.params.id,
      meta: { feature: req.params.key, enabled: body.enabled },
    });
    res.json({ ok: true });
  },
);

router.get('/plans', async (_req, res) => {
  const plans = await listPlans();
  res.json({ plans });
});

const planPatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  plan_limits: z
    .object({
      max_sites: z.number().int().positive(),
      max_conversations_month: z.number().int().positive(),
      max_tokens_month: z.number().int().positive(),
    })
    .optional(),
  stripe_price_id: z.string().nullable().optional(),
  is_public: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  sync_tenants: z.boolean().optional(),
});

router.patch('/plans/:id', requirePlatformWrite, async (req, res) => {
  const planId = z.enum(['trial', 'starter', 'growth', 'scale']).parse(req.params.id);
  const body = planPatchSchema.parse(req.body);
  const { sync_tenants, ...patch } = body;
  const plan = await updatePlan(planId, patch);
  let synced = 0;
  if (sync_tenants && patch.plan_limits) {
    synced = await syncPlanLimitsToTenants(planId);
  }
  await writeAuditLog({
    actorId: req.platformAuth!.adminId,
    actorEmail: req.platformAuth!.email,
    action: 'plan.update',
    targetType: 'plan',
    targetId: planId,
    meta: { ...patch, synced },
  });
  res.json({ plan, synced });
});

router.get('/settings', async (_req, res) => {
  const settings = await listSettings();
  res.json({ settings });
});

const settingPatchSchema = z.object({
  value: z.unknown(),
});

router.patch('/settings/:key', requirePlatformWrite, async (req, res) => {
  const body = settingPatchSchema.parse(req.body);
  const setting = await updateSetting(
    req.params.key,
    body.value,
    req.platformAuth!.adminId,
  );
  await writeAuditLog({
    actorId: req.platformAuth!.adminId,
    actorEmail: req.platformAuth!.email,
    action: 'setting.update',
    targetType: 'setting',
    targetId: req.params.key,
    meta: { value: body.value },
  });
  res.json({ setting });
});

router.get('/features', async (_req, res) => {
  const features = await listFeatureFlags();
  res.json({ features });
});

const featurePatchSchema = z.object({
  enabled: z.boolean().optional(),
  plans: z.array(z.enum(['trial', 'starter', 'growth', 'scale'])).optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

router.patch('/features/:key', requirePlatformWrite, async (req, res) => {
  const patch = featurePatchSchema.parse(req.body);
  const feature = await updateFeatureFlag(req.params.key, patch);
  await writeAuditLog({
    actorId: req.platformAuth!.adminId,
    actorEmail: req.platformAuth!.email,
    action: 'feature.update',
    targetType: 'feature',
    targetId: req.params.key,
    meta: patch,
  });
  res.json({ feature });
});

router.get('/source-types', async (_req, res) => {
  const types = await listOpenApiSourceTypes();
  res.json({ types });
});

const sourceTypeCreateSchema = z.object({
  key: z.string().min(1).max(64),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  routing: z
    .object({
      specialists: z
        .array(z.enum(['billing', 'technical', 'sales', 'account']))
        .optional(),
      alwaysInclude: z.boolean().optional(),
    })
    .optional(),
});

router.post('/source-types', requirePlatformWrite, async (req, res) => {
  const body = sourceTypeCreateSchema.parse(req.body);
  const type = await createOpenApiSourceType(body);
  await writeAuditLog({
    actorId: req.platformAuth!.adminId,
    actorEmail: req.platformAuth!.email,
    action: 'source_type.create',
    targetType: 'openapi_source_type',
    targetId: type.key,
    meta: body,
  });
  res.status(201).json({ type });
});

const sourceTypePatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  routing: z
    .object({
      specialists: z
        .array(z.enum(['billing', 'technical', 'sales', 'account']))
        .optional(),
      alwaysInclude: z.boolean().optional(),
    })
    .optional(),
});

router.patch('/source-types/:key', requirePlatformWrite, async (req, res) => {
  const patch = sourceTypePatchSchema.parse(req.body);
  const type = await updateOpenApiSourceType(req.params.key, patch);
  await writeAuditLog({
    actorId: req.platformAuth!.adminId,
    actorEmail: req.platformAuth!.email,
    action: 'source_type.update',
    targetType: 'openapi_source_type',
    targetId: req.params.key,
    meta: patch,
  });
  res.json({ type });
});

router.delete('/source-types/:key', requirePlatformWrite, async (req, res) => {
  await deleteOpenApiSourceType(req.params.key);
  await writeAuditLog({
    actorId: req.platformAuth!.adminId,
    actorEmail: req.platformAuth!.email,
    action: 'source_type.delete',
    targetType: 'openapi_source_type',
    targetId: req.params.key,
  });
  res.json({ ok: true });
});

router.get('/audit', async (req, res) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
  const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
  const result = await listAuditLog({ limit, offset });
  res.json(result);
});

router.get(
  '/admins',
  requirePlatformRole('super_admin'),
  async (_req, res) => {
    const admins = await listPlatformAdmins();
    res.json({ admins });
  },
);

export default router;
