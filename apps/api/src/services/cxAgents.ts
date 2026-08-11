import type {
  CxAgent,
  CxAgentStatus,
  CxKnowledgeItem,
  CxSpecialist,
} from '@nexus/shared-types';
import { DEFAULT_PLAN_LIMITS } from '@nexus/shared-types';
import { query, queryOne } from '../db';
import { checkPlanLimit, getTenantPlan } from './planLimits';
import { formatKnowledgeForPrompt } from './cxKnowledge';
import {
  formatRatingPolicyForPrompt,
  formatSalesGoalsForPrompt,
} from './cxSalesRatings';

const SPECIALISTS: CxSpecialist[] = ['billing', 'technical', 'sales', 'account'];

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'cx-agent';
}

async function uniqueSlug(tenantId: string, desired: string, excludeId?: string): Promise<string> {
  let slug = slugify(desired);
  for (let i = 0; i < 40; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM cx_agents WHERE tenant_id = $1 AND slug = $2
       ${excludeId ? 'AND id <> $3' : ''}`,
      excludeId ? [tenantId, candidate, excludeId] : [tenantId, candidate],
    );
    if (!existing) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

function normalizeSpecialists(list?: string[] | null): CxSpecialist[] {
  if (!list?.length) return [...SPECIALISTS];
  const set = new Set(
    list.filter((s): s is CxSpecialist => SPECIALISTS.includes(s as CxSpecialist)),
  );
  return set.size ? [...set] : [...SPECIALISTS];
}

export async function countCxAgents(tenantId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM cx_agents WHERE tenant_id = $1`,
    [tenantId],
  );
  return row ? parseInt(row.count, 10) : 0;
}

export async function listCxAgents(tenantId: string): Promise<CxAgent[]> {
  return query<CxAgent>(
    `SELECT a.*,
       (
         SELECT COUNT(*)::int FROM conversations c
         WHERE c.cx_agent_id = a.id
           AND c.status IN ('open', 'queued', 'human')
       ) AS active_chats
     FROM cx_agents a
     WHERE a.tenant_id = $1
     ORDER BY a.sort_order ASC, a.created_at ASC`,
    [tenantId],
  );
}

export async function getCxAgent(
  tenantId: string,
  agentId: string,
): Promise<CxAgent | null> {
  return queryOne<CxAgent>(
    `SELECT a.*,
       (
         SELECT COUNT(*)::int FROM conversations c
         WHERE c.cx_agent_id = a.id
           AND c.status IN ('open', 'queued', 'human')
       ) AS active_chats
     FROM cx_agents a
     WHERE a.tenant_id = $1 AND a.id = $2`,
    [tenantId, agentId],
  );
}

export async function getCxAgentById(agentId: string): Promise<CxAgent | null> {
  return queryOne<CxAgent>(`SELECT * FROM cx_agents WHERE id = $1`, [agentId]);
}

export interface CreateCxAgentInput {
  tenantId: string;
  name: string;
  displayName?: string;
  roleSummary?: string;
  tone?: string;
  systemPrompt?: string;
  maxConcurrentChats?: number;
  allowedSpecialists?: string[];
  status?: CxAgentStatus;
  salesGoals?: Record<string, unknown>;
  ratingPolicy?: Record<string, unknown>;
}

export async function createCxAgent(input: CreateCxAgentInput): Promise<CxAgent> {
  const { plan, limits } = await getTenantPlan(input.tenantId);
  if (limits.cx_agents_enabled === false) {
    throw Object.assign(new Error('CX Agents are not enabled on your plan'), {
      status: 403,
      code: 'CX_DISABLED',
    });
  }

  const limitCheck = await checkPlanLimit(input.tenantId, 'max_cx_agents');
  if (!limitCheck.allowed) {
    throw Object.assign(
      new Error(
        limitCheck.message ??
          `Plan allows ${limitCheck.limit} CX Agent(s). Upgrade or pause an existing agent.`,
      ),
      { status: 403, code: 'CX_LIMIT' },
    );
  }

  const defaults = DEFAULT_PLAN_LIMITS[plan];
  const defaultConcurrent =
    limits.default_max_concurrent_chats ?? defaults.default_max_concurrent_chats ?? 5;
  const cap = limits.max_concurrent_chats_cap ?? defaults.max_concurrent_chats_cap ?? 50;

  let concurrent = input.maxConcurrentChats ?? defaultConcurrent;
  concurrent = Math.max(1, Math.min(concurrent, cap));

  const slug = await uniqueSlug(input.tenantId, input.name);
  const displayName = (input.displayName ?? input.name).trim().slice(0, 80);
  const salesGoals = input.salesGoals ?? {};
  const ratingPolicy = input.ratingPolicy ?? {
    ask_after_resolve: true,
    scale: 5,
    allow_comment: true,
  };

  const row = await queryOne<CxAgent>(
    `INSERT INTO cx_agents (
       tenant_id, name, slug, display_name, status, role_summary, tone,
       system_prompt, max_concurrent_chats, allowed_specialists, sales_goals, rating_policy
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      input.tenantId,
      input.name.trim().slice(0, 80),
      slug,
      displayName,
      input.status ?? 'draft',
      input.roleSummary?.trim() || null,
      input.tone?.trim() || null,
      input.systemPrompt?.trim() || null,
      concurrent,
      normalizeSpecialists(input.allowedSpecialists),
      JSON.stringify(salesGoals),
      JSON.stringify(ratingPolicy),
    ],
  );
  if (!row) throw new Error('Failed to create CX agent');
  return { ...row, active_chats: 0 };
}

export interface UpdateCxAgentInput {
  tenantId: string;
  agentId: string;
  name?: string;
  displayName?: string;
  avatarUrl?: string | null;
  status?: CxAgentStatus;
  roleSummary?: string | null;
  tone?: string | null;
  systemPrompt?: string | null;
  maxConcurrentChats?: number;
  allowedSpecialists?: string[];
  salesGoals?: Record<string, unknown>;
  ratingPolicy?: Record<string, unknown>;
  sortOrder?: number;
}

export async function updateCxAgent(input: UpdateCxAgentInput): Promise<CxAgent> {
  const existing = await getCxAgent(input.tenantId, input.agentId);
  if (!existing) {
    throw Object.assign(new Error('CX Agent not found'), { status: 404, code: 'NOT_FOUND' });
  }

  const { limits, plan } = await getTenantPlan(input.tenantId);
  const cap =
    limits.max_concurrent_chats_cap ??
    DEFAULT_PLAN_LIMITS[plan].max_concurrent_chats_cap ??
    50;

  const sets: string[] = ['updated_at = now()'];
  const params: unknown[] = [];
  let i = 1;

  const add = (col: string, val: unknown) => {
    sets.push(`${col} = $${i++}`);
    params.push(val);
  };

  if (input.name !== undefined) {
    add('name', input.name.trim().slice(0, 80));
    const slug = await uniqueSlug(input.tenantId, input.name, input.agentId);
    add('slug', slug);
  }
  if (input.displayName !== undefined) {
    add('display_name', input.displayName.trim().slice(0, 80));
  }
  if (input.avatarUrl !== undefined) add('avatar_url', input.avatarUrl);
  if (input.status !== undefined) add('status', input.status);
  if (input.roleSummary !== undefined) add('role_summary', input.roleSummary);
  if (input.tone !== undefined) add('tone', input.tone);
  if (input.systemPrompt !== undefined) add('system_prompt', input.systemPrompt);
  if (input.maxConcurrentChats !== undefined) {
    add('max_concurrent_chats', Math.max(1, Math.min(input.maxConcurrentChats, cap)));
  }
  if (input.allowedSpecialists !== undefined) {
    add('allowed_specialists', normalizeSpecialists(input.allowedSpecialists));
  }
  if (input.salesGoals !== undefined) add('sales_goals', JSON.stringify(input.salesGoals));
  if (input.ratingPolicy !== undefined) {
    add('rating_policy', JSON.stringify(input.ratingPolicy));
  }
  if (input.sortOrder !== undefined) add('sort_order', input.sortOrder);

  params.push(input.tenantId, input.agentId);
  const row = await queryOne<CxAgent>(
    `UPDATE cx_agents SET ${sets.join(', ')}
     WHERE tenant_id = $${i++} AND id = $${i}
     RETURNING *`,
    params,
  );
  if (!row) throw new Error('Failed to update CX agent');
  return getCxAgent(input.tenantId, input.agentId) as Promise<CxAgent>;
}

export async function deleteCxAgent(tenantId: string, agentId: string): Promise<void> {
  const row = await queryOne<{ id: string }>(
    `DELETE FROM cx_agents WHERE tenant_id = $1 AND id = $2 RETURNING id`,
    [tenantId, agentId],
  );
  if (!row) {
    throw Object.assign(new Error('CX Agent not found'), { status: 404, code: 'NOT_FOUND' });
  }
}

/**
 * Duplicate a CX Agent (persona, capacity, specialists, sales/rating config, avatar).
 * Always starts as draft so the copy can be renamed/reviewed before going live.
 * Agent-scoped knowledge is copied; shared knowledge is left as-is (both agents see it).
 */
export async function cloneCxAgent(
  tenantId: string,
  agentId: string,
): Promise<{ agent: CxAgent; knowledgeCopied: number }> {
  const source = await getCxAgent(tenantId, agentId);
  if (!source) {
    throw Object.assign(new Error('CX Agent not found'), { status: 404, code: 'NOT_FOUND' });
  }

  const baseName = source.name.replace(/\s*\(copy(?:\s+\d+)?\)\s*$/i, '').trim() || source.name;
  const copyName = `${baseName} (copy)`.slice(0, 80);
  const baseDisplay =
    source.display_name.replace(/\s*\(copy(?:\s+\d+)?\)\s*$/i, '').trim() || source.display_name;
  const copyDisplay = `${baseDisplay} (copy)`.slice(0, 80);

  const agent = await createCxAgent({
    tenantId,
    name: copyName,
    displayName: copyDisplay,
    roleSummary: source.role_summary ?? undefined,
    tone: source.tone ?? undefined,
    systemPrompt: source.system_prompt ?? undefined,
    maxConcurrentChats: source.max_concurrent_chats,
    allowedSpecialists: source.allowed_specialists,
    status: 'draft',
    salesGoals: (source.sales_goals as Record<string, unknown>) ?? {},
    ratingPolicy: (source.rating_policy as Record<string, unknown>) ?? {
      ask_after_resolve: true,
      scale: 5,
      allow_comment: true,
    },
  });

  if (source.avatar_url) {
    await queryOne(`UPDATE cx_agents SET avatar_url = $1 WHERE id = $2`, [
      source.avatar_url,
      agent.id,
    ]);
    agent.avatar_url = source.avatar_url;
  }

  const { cloneAgentKnowledge } = await import('./cxKnowledge');
  const knowledgeCopied = await cloneAgentKnowledge({
    tenantId,
    fromAgentId: source.id,
    toAgentId: agent.id,
  });

  return { agent, knowledgeCopied };
}

/** Count open/queued chats owned by this CX agent (human-claimed still occupies until resolve). */
export async function countActiveChats(agentId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM conversations
     WHERE cx_agent_id = $1 AND status IN ('open', 'queued', 'human')`,
    [agentId],
  );
  return row ? parseInt(row.count, 10) : 0;
}

/**
 * Pick the least-loaded active CX agent under capacity for this tenant.
 * Returns null when feature off or none available.
 */
export async function pickAvailableCxAgent(tenantId: string): Promise<CxAgent | null> {
  const { limits } = await getTenantPlan(tenantId);
  if (limits.cx_agents_enabled === false) return null;

  const agents = await query<CxAgent & { load: number }>(
    `SELECT a.*,
       (
         SELECT COUNT(*)::int FROM conversations c
         WHERE c.cx_agent_id = a.id
           AND c.status IN ('open', 'queued', 'human')
       ) AS load
     FROM cx_agents a
     WHERE a.tenant_id = $1 AND a.status = 'active'
     ORDER BY load ASC, a.sort_order ASC, a.created_at ASC`,
    [tenantId],
  );

  for (const agent of agents) {
    if ((agent.load ?? 0) < agent.max_concurrent_chats) {
      return agent;
    }
  }
  return null;
}

export async function assignCxAgentToConversation(
  conversationId: string,
  agentId: string,
): Promise<void> {
  await queryOne(`UPDATE conversations SET cx_agent_id = $1 WHERE id = $2`, [
    agentId,
    conversationId,
  ]);
}

export async function releaseCxAgentFromConversation(conversationId: string): Promise<void> {
  await queryOne(`UPDATE conversations SET cx_agent_id = NULL WHERE id = $1`, [
    conversationId,
  ]);
}

/** Build the CX persona block injected into the orchestrator system prompt. */
export function buildCxAgentRolePrompt(
  agent: CxAgent,
  knowledgeItems?: CxKnowledgeItem[],
): string {
  const parts = [
    `You are **${agent.display_name}**, a Customer Experience (CX) agent for this organization.`,
  ];
  if (agent.role_summary?.trim()) {
    parts.push(`## Your role\n${agent.role_summary.trim()}`);
  }
  if (agent.tone?.trim()) {
    parts.push(`## Tone\n${agent.tone.trim()}`);
  }
  if (agent.system_prompt?.trim()) {
    parts.push(`## Instructions\n${agent.system_prompt.trim()}`);
  } else {
    parts.push(
      `## Instructions\nHelp visitors with products, services, and FAQs. Be clear and helpful. Drive sales only when it genuinely helps the visitor.`,
    );
  }
  if (knowledgeItems?.length) {
    const kb = formatKnowledgeForPrompt(knowledgeItems);
    if (kb) parts.push(kb);
  }
  const sales = formatSalesGoalsForPrompt(agent.sales_goals);
  if (sales) parts.push(sales);
  const ratings = formatRatingPolicyForPrompt(agent.rating_policy);
  if (ratings) parts.push(ratings);
  if (agent.allowed_specialists?.length) {
    parts.push(
      `## Specialists you may call when needed\n${agent.allowed_specialists.join(', ')}.
When you need domain depth (orders, billing, technical issues, sales details, account changes), call the **consult_specialist** tool.
Stay the customer-facing owner. Do not tell the visitor you are transferring to another AI — fold the specialist brief into your own reply.`,
    );
  }
  return parts.join('\n\n');
}
