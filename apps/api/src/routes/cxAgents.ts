import { Router } from 'express';
import { z } from 'zod';
import { TenantRole } from '@nexus/shared-types';
import { requireTenantAuth } from '../middleware/auth';
import {
  cloneCxAgent,
  createCxAgent,
  deleteCxAgent,
  getCxAgent,
  listCxAgents,
  updateCxAgent,
} from '../services/cxAgents';
import { getTenantPlan } from '../services/planLimits';

const router = Router();

const specialistEnum = z.enum(['billing', 'technical', 'sales', 'account']);
const statusEnum = z.enum(['draft', 'active', 'paused']);

function canManage(role: TenantRole | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

router.get('/', requireTenantAuth, async (req, res) => {
  const { plan, limits } = await getTenantPlan(req.tenantId!);
  const agents = await listCxAgents(req.tenantId!);
  res.json({ agents, plan, limits });
});

router.get('/consults', requireTenantAuth, async (req, res) => {
  const schema = z.object({
    cxAgentId: z.string().uuid().optional(),
    conversationId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  });
  const q = schema.parse(req.query);
  const { listCxConsults } = await import('../services/cxConsults');
  const consults = await listCxConsults({
    tenantId: req.tenantId!,
    cxAgentId: q.cxAgentId,
    conversationId: q.conversationId,
    limit: q.limit,
  });
  res.json({ consults });
});

router.get('/live-graph', requireTenantAuth, async (req, res) => {
  const { getCxLiveGraph } = await import('../services/cxOps');
  const graph = await getCxLiveGraph(req.tenantId!);
  res.json({ graph });
});

router.get('/leaderboard', requireTenantAuth, async (req, res) => {
  const schema = z.object({
    period: z.enum(['today', '7d', '30d']).optional(),
  });
  const q = schema.parse(req.query);
  const { getCxLeaderboard } = await import('../services/cxOps');
  const leaderboard = await getCxLeaderboard(req.tenantId!, q.period ?? '7d');
  res.json({ leaderboard });
});

router.get('/knowledge', requireTenantAuth, async (req, res) => {
  const schema = z.object({
    cxAgentId: z.string().uuid().optional(),
    shared: z
      .union([z.literal('true'), z.literal('1'), z.literal('false'), z.literal('0')])
      .optional(),
    includeShared: z
      .union([z.literal('true'), z.literal('1'), z.literal('false'), z.literal('0')])
      .optional(),
  });
  const q = schema.parse(req.query);
  const sharedOnly = q.shared === 'true' || q.shared === '1';
  const includeShared =
    q.includeShared === 'true' || q.includeShared === '1';
  const { listKnowledge } = await import('../services/cxKnowledge');
  const items = await listKnowledge({
    tenantId: req.tenantId!,
    cxAgentId: sharedOnly ? undefined : q.cxAgentId,
    includeShared: sharedOnly ? false : includeShared,
    sharedOnly,
  });
  res.json({ items });
});

router.post('/knowledge/seed-defaults', requireTenantAuth, async (req, res) => {
  if (!canManage(req.auth?.role as TenantRole | undefined)) {
    res.status(403).json({ error: 'Only owners and admins can manage knowledge' });
    return;
  }
  try {
    const { seedDefaultKnowledge } = await import('../services/cxKnowledge');
    const result = await seedDefaultKnowledge(req.tenantId!);
    res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    res.status(e.status ?? 500).json({ error: e.message, code: e.code });
  }
});

router.post('/knowledge', requireTenantAuth, async (req, res) => {
  if (!canManage(req.auth?.role as TenantRole | undefined)) {
    res.status(403).json({ error: 'Only owners and admins can manage knowledge' });
    return;
  }
  const schema = z.object({
    cxAgentId: z.string().uuid().nullable().optional(),
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(8000),
    category: z.string().max(40).optional(),
  });
  const body = schema.parse(req.body);
  try {
    const { createKnowledge } = await import('../services/cxKnowledge');
    const item = await createKnowledge({
      tenantId: req.tenantId!,
      cxAgentId: body.cxAgentId,
      title: body.title,
      body: body.body,
      category: body.category,
    });
    res.status(201).json({ item });
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    res.status(e.status ?? 500).json({ error: e.message, code: e.code });
  }
});

router.patch('/knowledge/:knowledgeId', requireTenantAuth, async (req, res) => {
  if (!canManage(req.auth?.role as TenantRole | undefined)) {
    res.status(403).json({ error: 'Only owners and admins can manage knowledge' });
    return;
  }
  const schema = z.object({
    title: z.string().min(1).max(200).optional(),
    body: z.string().min(1).max(8000).optional(),
    category: z.string().max(40).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    cxAgentId: z.string().uuid().nullable().optional(),
  });
  const body = schema.parse(req.body);
  try {
    const { updateKnowledge } = await import('../services/cxKnowledge');
    const item = await updateKnowledge({
      tenantId: req.tenantId!,
      id: req.params.knowledgeId,
      ...body,
    });
    res.json({ item });
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    res.status(e.status ?? 500).json({ error: e.message, code: e.code });
  }
});

router.delete('/knowledge/:knowledgeId', requireTenantAuth, async (req, res) => {
  if (!canManage(req.auth?.role as TenantRole | undefined)) {
    res.status(403).json({ error: 'Only owners and admins can manage knowledge' });
    return;
  }
  try {
    const { deleteKnowledge } = await import('../services/cxKnowledge');
    await deleteKnowledge(req.tenantId!, req.params.knowledgeId);
    res.json({ ok: true });
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    res.status(e.status ?? 500).json({ error: e.message, code: e.code });
  }
});

router.get('/ratings', requireTenantAuth, async (req, res) => {
  const schema = z.object({
    cxAgentId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  });
  const q = schema.parse(req.query);
  const { listCxRatings } = await import('../services/cxSalesRatings');
  const ratings = await listCxRatings({
    tenantId: req.tenantId!,
    cxAgentId: q.cxAgentId,
    limit: q.limit,
  });
  res.json({ ratings });
});

router.get('/sales-events', requireTenantAuth, async (req, res) => {
  const schema = z.object({
    cxAgentId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  });
  const q = schema.parse(req.query);
  const { listSalesEvents } = await import('../services/cxSalesRatings');
  const events = await listSalesEvents({
    tenantId: req.tenantId!,
    cxAgentId: q.cxAgentId,
    limit: q.limit,
  });
  res.json({ events });
});

router.get('/:id', requireTenantAuth, async (req, res) => {
  const agent = await getCxAgent(req.tenantId!, req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'CX Agent not found', code: 'NOT_FOUND' });
    return;
  }
  const { listCxConsults } = await import('../services/cxConsults');
  const consults = await listCxConsults({
    tenantId: req.tenantId!,
    cxAgentId: agent.id,
    limit: 20,
  });
  res.json({ agent, consults });
});

router.post('/', requireTenantAuth, async (req, res) => {
  if (!canManage(req.auth?.role as TenantRole | undefined)) {
    res.status(403).json({ error: 'Only owners and admins can create CX Agents' });
    return;
  }
  const schema = z.object({
    name: z.string().min(1).max(80),
    displayName: z.string().max(80).optional(),
    roleSummary: z.string().max(500).optional(),
    tone: z.string().max(200).optional(),
    systemPrompt: z.string().max(8000).optional(),
    maxConcurrentChats: z.number().int().min(1).max(200).optional(),
    allowedSpecialists: z.array(specialistEnum).optional(),
    status: statusEnum.optional(),
    salesGoals: z.record(z.unknown()).optional(),
    ratingPolicy: z.record(z.unknown()).optional(),
  });
  const body = schema.parse(req.body);
  try {
    const agent = await createCxAgent({
      tenantId: req.tenantId!,
      name: body.name,
      displayName: body.displayName,
      roleSummary: body.roleSummary,
      tone: body.tone,
      systemPrompt: body.systemPrompt,
      maxConcurrentChats: body.maxConcurrentChats,
      allowedSpecialists: body.allowedSpecialists,
      status: body.status,
      salesGoals: body.salesGoals,
      ratingPolicy: body.ratingPolicy,
    });
    res.status(201).json({ agent });
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    res.status(e.status ?? 500).json({ error: e.message, code: e.code });
  }
});

router.post('/:id/clone', requireTenantAuth, async (req, res) => {
  if (!canManage(req.auth?.role as TenantRole | undefined)) {
    res.status(403).json({ error: 'Only owners and admins can clone CX Agents' });
    return;
  }
  try {
    const { agent, knowledgeCopied } = await cloneCxAgent(req.tenantId!, req.params.id);
    res.status(201).json({ agent, knowledgeCopied });
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    res.status(e.status ?? 500).json({ error: e.message, code: e.code });
  }
});

router.patch('/:id', requireTenantAuth, async (req, res) => {
  if (!canManage(req.auth?.role as TenantRole | undefined)) {
    res.status(403).json({ error: 'Only owners and admins can update CX Agents' });
    return;
  }
  const schema = z.object({
    name: z.string().min(1).max(80).optional(),
    displayName: z.string().max(80).optional(),
    avatarUrl: z.string().url().nullable().optional(),
    status: statusEnum.optional(),
    roleSummary: z.string().max(500).nullable().optional(),
    tone: z.string().max(200).nullable().optional(),
    systemPrompt: z.string().max(8000).nullable().optional(),
    maxConcurrentChats: z.number().int().min(1).max(200).optional(),
    allowedSpecialists: z.array(specialistEnum).optional(),
    salesGoals: z.record(z.unknown()).optional(),
    ratingPolicy: z.record(z.unknown()).optional(),
    sortOrder: z.number().int().optional(),
  });
  const body = schema.parse(req.body);
  try {
    const agent = await updateCxAgent({
      tenantId: req.tenantId!,
      agentId: req.params.id,
      name: body.name,
      displayName: body.displayName,
      avatarUrl: body.avatarUrl,
      status: body.status,
      roleSummary: body.roleSummary,
      tone: body.tone,
      systemPrompt: body.systemPrompt,
      maxConcurrentChats: body.maxConcurrentChats,
      allowedSpecialists: body.allowedSpecialists,
      salesGoals: body.salesGoals,
      ratingPolicy: body.ratingPolicy,
      sortOrder: body.sortOrder,
    });
    res.json({ agent });
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    res.status(e.status ?? 500).json({ error: e.message, code: e.code });
  }
});

router.delete('/:id', requireTenantAuth, async (req, res) => {
  if (!canManage(req.auth?.role as TenantRole | undefined)) {
    res.status(403).json({ error: 'Only owners and admins can delete CX Agents' });
    return;
  }
  try {
    await deleteCxAgent(req.tenantId!, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    res.status(e.status ?? 500).json({ error: e.message, code: e.code });
  }
});

export default router;
