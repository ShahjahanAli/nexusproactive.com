import type { CxKnowledgeItem } from '@nexus/shared-types';
import { query, queryOne } from '../db';
import { getTenantPlan } from './planLimits';
import { DEFAULT_PLAN_LIMITS } from '@nexus/shared-types';

/** Starter FAQ/product templates installed as shared (all CX Agents inherit them). */
export const CX_KNOWLEDGE_STARTERS: Array<{
  title: string;
  category: string;
  body: string;
  sort_order: number;
}> = [
  {
    title: 'Business hours',
    category: 'faq',
    body: 'We are available Monday–Friday, 9:00 AM – 6:00 PM (local time). Messages outside these hours are answered on the next business day. Edit this item with your real hours and timezone.',
    sort_order: 10,
  },
  {
    title: 'How to contact a human',
    category: 'faq',
    body: 'If the visitor asks for a person, offer to connect them with a human agent via handoff. Do not invent phone numbers or emails — use only what is listed here after you edit this item.',
    sort_order: 20,
  },
  {
    title: 'Products & services overview',
    category: 'product',
    body: 'Summarize what you sell or offer in 3–6 short bullets. Include who it is for and the main benefit. Replace this placeholder before going live.',
    sort_order: 30,
  },
  {
    title: 'Pricing & plans',
    category: 'product',
    body: 'Describe your pricing at a high level (plans, starting price, what is included). If exact quotes need a human or a tool lookup, say so clearly here.',
    sort_order: 40,
  },
  {
    title: 'Orders & status',
    category: 'policy',
    body: 'To check an order or registration, ask for the email on the account plus an order or registration number. Prefer looking it up with available tools rather than guessing.',
    sort_order: 50,
  },
  {
    title: 'Refunds & cancellations',
    category: 'policy',
    body: 'Outline your refund and cancellation rules (window, conditions, how long refunds take). Soften only when the policy allows — otherwise escalate to a human.',
    sort_order: 60,
  },
  {
    title: 'Shipping & delivery',
    category: 'policy',
    body: 'Typical delivery times, shipping regions, and how visitors track packages. Remove this item if it does not apply to your business.',
    sort_order: 70,
  },
  {
    title: 'Privacy & data',
    category: 'policy',
    body: 'We only use visitor details to help with their request. Do not ask for passwords, full payment card numbers, or government IDs in chat.',
    sort_order: 80,
  },
];

export async function listKnowledge(opts: {
  tenantId: string;
  cxAgentId?: string | null;
  includeShared?: boolean;
  /** When true, only shared defaults (cx_agent_id IS NULL). */
  sharedOnly?: boolean;
}): Promise<CxKnowledgeItem[]> {
  if (opts.sharedOnly) {
    return query<CxKnowledgeItem>(
      `SELECT * FROM cx_agent_knowledge
       WHERE tenant_id = $1 AND cx_agent_id IS NULL
       ORDER BY sort_order ASC, created_at ASC`,
      [opts.tenantId],
    );
  }
  if (opts.cxAgentId) {
    if (opts.includeShared !== false) {
      return query<CxKnowledgeItem>(
        `SELECT * FROM cx_agent_knowledge
         WHERE tenant_id = $1
           AND is_active = true
           AND (cx_agent_id = $2 OR cx_agent_id IS NULL)
         ORDER BY sort_order ASC, created_at ASC`,
        [opts.tenantId, opts.cxAgentId],
      );
    }
    return query<CxKnowledgeItem>(
      `SELECT * FROM cx_agent_knowledge
       WHERE tenant_id = $1 AND cx_agent_id = $2
       ORDER BY sort_order ASC, created_at ASC`,
      [opts.tenantId, opts.cxAgentId],
    );
  }
  return query<CxKnowledgeItem>(
    `SELECT * FROM cx_agent_knowledge
     WHERE tenant_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [opts.tenantId],
  );
}

export async function countSharedKnowledge(tenantId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM cx_agent_knowledge
     WHERE tenant_id = $1 AND cx_agent_id IS NULL`,
    [tenantId],
  );
  return row ? parseInt(row.count, 10) : 0;
}

/**
 * Install starter default knowledge for the tenant (shared across all CX Agents).
 * Skips titles that already exist as shared items. Respects knowledge cap.
 */
export async function seedDefaultKnowledge(tenantId: string): Promise<{
  created: number;
  skipped: number;
  items: CxKnowledgeItem[];
}> {
  const existing = await listKnowledge({ tenantId, sharedOnly: true });
  const existingTitles = new Set(existing.map((i) => i.title.toLowerCase()));

  const { plan, limits } = await getTenantPlan(tenantId);
  const cap =
    limits.cx_knowledge_items_cap ??
    DEFAULT_PLAN_LIMITS[plan].cx_knowledge_items_cap ??
    50;
  let current = await countKnowledge(tenantId);

  let created = 0;
  let skipped = 0;
  const items: CxKnowledgeItem[] = [];

  for (const starter of CX_KNOWLEDGE_STARTERS) {
    if (existingTitles.has(starter.title.toLowerCase())) {
      skipped += 1;
      continue;
    }
    if (current >= cap) break;

    const row = await queryOne<CxKnowledgeItem>(
      `INSERT INTO cx_agent_knowledge
         (tenant_id, cx_agent_id, title, body, category, sort_order)
       VALUES ($1, NULL, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, starter.title, starter.body, starter.category, starter.sort_order],
    );
    if (row) {
      items.push(row);
      created += 1;
      current += 1;
    }
  }

  return { created, skipped, items };
}

export async function countKnowledge(tenantId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM cx_agent_knowledge WHERE tenant_id = $1`,
    [tenantId],
  );
  return row ? parseInt(row.count, 10) : 0;
}

export async function createKnowledge(input: {
  tenantId: string;
  cxAgentId?: string | null;
  title: string;
  body: string;
  category?: string;
}): Promise<CxKnowledgeItem> {
  const { plan, limits } = await getTenantPlan(input.tenantId);
  const cap =
    limits.cx_knowledge_items_cap ??
    DEFAULT_PLAN_LIMITS[plan].cx_knowledge_items_cap ??
    50;
  const current = await countKnowledge(input.tenantId);
  if (current >= cap) {
    throw Object.assign(
      new Error(`Knowledge cap reached (${cap}). Remove items or upgrade your plan.`),
      { status: 403, code: 'KNOWLEDGE_CAP' },
    );
  }

  const row = await queryOne<CxKnowledgeItem>(
    `INSERT INTO cx_agent_knowledge (tenant_id, cx_agent_id, title, body, category)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.tenantId,
      input.cxAgentId ?? null,
      input.title.trim().slice(0, 200),
      input.body.trim().slice(0, 8000),
      (input.category ?? 'faq').trim().slice(0, 40) || 'faq',
    ],
  );
  if (!row) throw new Error('Failed to create knowledge item');
  return row;
}

export async function updateKnowledge(input: {
  tenantId: string;
  id: string;
  title?: string;
  body?: string;
  category?: string;
  isActive?: boolean;
  sortOrder?: number;
  cxAgentId?: string | null;
}): Promise<CxKnowledgeItem> {
  const sets: string[] = ['updated_at = now()'];
  const params: unknown[] = [];
  let i = 1;
  const add = (col: string, val: unknown) => {
    sets.push(`${col} = $${i++}`);
    params.push(val);
  };
  if (input.title !== undefined) add('title', input.title.trim().slice(0, 200));
  if (input.body !== undefined) add('body', input.body.trim().slice(0, 8000));
  if (input.category !== undefined) add('category', input.category.trim().slice(0, 40));
  if (input.isActive !== undefined) add('is_active', input.isActive);
  if (input.sortOrder !== undefined) add('sort_order', input.sortOrder);
  if (input.cxAgentId !== undefined) add('cx_agent_id', input.cxAgentId);

  params.push(input.tenantId, input.id);
  const row = await queryOne<CxKnowledgeItem>(
    `UPDATE cx_agent_knowledge SET ${sets.join(', ')}
     WHERE tenant_id = $${i++} AND id = $${i}
     RETURNING *`,
    params,
  );
  if (!row) {
    throw Object.assign(new Error('Knowledge item not found'), {
      status: 404,
      code: 'NOT_FOUND',
    });
  }
  return row;
}

export async function deleteKnowledge(tenantId: string, id: string): Promise<void> {
  const row = await queryOne<{ id: string }>(
    `DELETE FROM cx_agent_knowledge WHERE tenant_id = $1 AND id = $2 RETURNING id`,
    [tenantId, id],
  );
  if (!row) {
    throw Object.assign(new Error('Knowledge item not found'), {
      status: 404,
      code: 'NOT_FOUND',
    });
  }
}

/**
 * Copy agent-scoped knowledge onto a new CX Agent.
 * Shared (cx_agent_id IS NULL) items are not copied — both agents already see them.
 * Respects the tenant knowledge cap; copies as many as will fit.
 */
export async function cloneAgentKnowledge(opts: {
  tenantId: string;
  fromAgentId: string;
  toAgentId: string;
}): Promise<number> {
  const source = await query<CxKnowledgeItem>(
    `SELECT * FROM cx_agent_knowledge
     WHERE tenant_id = $1 AND cx_agent_id = $2
     ORDER BY sort_order ASC, created_at ASC`,
    [opts.tenantId, opts.fromAgentId],
  );
  if (!source.length) return 0;

  const { plan, limits } = await getTenantPlan(opts.tenantId);
  const cap =
    limits.cx_knowledge_items_cap ??
    DEFAULT_PLAN_LIMITS[plan].cx_knowledge_items_cap ??
    50;
  const current = await countKnowledge(opts.tenantId);
  const room = Math.max(0, cap - current);
  if (room === 0) return 0;

  const toCopy = source.slice(0, room);
  let copied = 0;
  for (const item of toCopy) {
    await queryOne(
      `INSERT INTO cx_agent_knowledge
         (tenant_id, cx_agent_id, title, body, category, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        opts.tenantId,
        opts.toAgentId,
        item.title,
        item.body,
        item.category,
        item.is_active,
        item.sort_order,
      ],
    );
    copied += 1;
  }
  return copied;
}

/** Compact knowledge block for the CX system prompt (token-aware). */
export function formatKnowledgeForPrompt(items: CxKnowledgeItem[], maxChars = 3500): string {
  if (!items.length) return '';
  const lines: string[] = ['## Knowledge base (use as ground truth; do not invent beyond this)'];
  let used = lines[0].length;
  for (const item of items) {
    const block = `\n### ${item.title} [${item.category}]\n${item.body.trim()}`;
    if (used + block.length > maxChars) {
      lines.push('\n_(Additional knowledge truncated.)_');
      break;
    }
    lines.push(block);
    used += block.length;
  }
  return lines.join('');
}
