import {
  AdminAuditEntry,
  FeatureFlag,
  Plan,
  PlanLimits,
  PlatformOverviewStats,
  PlatformPlan,
  PlatformSetting,
  TenantStatus,
  TenantUser,
} from '@nexus/shared-types';
import { query, queryOne } from '../db';
import { AppError } from '../middleware/errorHandler';
import { currentPeriodStart } from '../lib/timezone';

export async function writeAuditLog(input: {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO admin_audit_log (actor_id, actor_email, action, target_type, target_id, meta)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.actorId ?? null,
      input.actorEmail ?? null,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      JSON.stringify(input.meta ?? {}),
    ],
  );
}

export async function getOverviewStats(): Promise<PlatformOverviewStats> {
  const periodStart = currentPeriodStart();

  const [totals, byPlanRows, usage] = await Promise.all([
    queryOne<{
      tenants_total: string;
      tenants_active: string;
      tenants_suspended: string;
      sites_total: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM tenants) AS tenants_total,
        (SELECT COUNT(*)::text FROM tenants WHERE status = 'active') AS tenants_active,
        (SELECT COUNT(*)::text FROM tenants WHERE status = 'suspended') AS tenants_suspended,
        (SELECT COUNT(*)::text FROM sites) AS sites_total
    `),
    query<{ plan: Plan; count: string }>(
      `SELECT plan, COUNT(*)::text AS count FROM tenants GROUP BY plan`,
    ),
    queryOne<{ conversations: string; tokens: string }>(
      `SELECT COALESCE(SUM(conversations_count),0)::text AS conversations,
              COALESCE(SUM(tokens_used),0)::text AS tokens
       FROM usage_records WHERE period_start = $1`,
      [periodStart],
    ),
  ]);

  const by_plan: Record<Plan, number> = {
    trial: 0,
    starter: 0,
    growth: 0,
    scale: 0,
  };
  for (const row of byPlanRows) {
    by_plan[row.plan] = parseInt(row.count, 10);
  }

  return {
    tenants_total: parseInt(totals?.tenants_total ?? '0', 10),
    tenants_active: parseInt(totals?.tenants_active ?? '0', 10),
    tenants_suspended: parseInt(totals?.tenants_suspended ?? '0', 10),
    sites_total: parseInt(totals?.sites_total ?? '0', 10),
    conversations_month: parseInt(usage?.conversations ?? '0', 10),
    tokens_month: parseInt(usage?.tokens ?? '0', 10),
    by_plan,
  };
}

export interface PlatformTenantRow {
  id: string;
  company_name: string;
  owner_email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: Plan;
  plan_limits: PlanLimits;
  status: TenantStatus;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  sites_count: string;
  users_count: string;
  conversations_count: string;
  tokens_used: string;
}

export async function listTenants(opts: {
  q?: string;
  plan?: Plan;
  status?: TenantStatus;
  limit?: number;
  offset?: number;
}): Promise<{ tenants: PlatformTenantRow[]; total: number }> {
  const periodStart = currentPeriodStart();
  const filters: unknown[] = [];
  const filterConds: string[] = [];

  if (opts.q) {
    filters.push(`%${opts.q}%`);
    const p = `$${filters.length}`;
    filterConds.push(`(t.company_name ILIKE ${p} OR t.owner_email ILIKE ${p} OR t.id::text ILIKE ${p})`);
  }
  if (opts.plan) {
    filters.push(opts.plan);
    filterConds.push(`t.plan = $${filters.length}`);
  }
  if (opts.status) {
    filters.push(opts.status);
    filterConds.push(`t.status = $${filters.length}`);
  }

  const countWhere = filterConds.length ? `WHERE ${filterConds.join(' AND ')}` : '';
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM tenants t ${countWhere}`,
    filters,
  );

  // Shift filter placeholders by +1 because $1 is period_start in the list query.
  const listConds = filterConds.map((c) =>
    c.replace(/\$(\d+)/g, (_m, n: string) => `$${parseInt(n, 10) + 1}`),
  );
  const listWhere = listConds.length ? `WHERE ${listConds.join(' AND ')}` : '';
  const limitParam = filters.length + 2;
  const offsetParam = filters.length + 3;

  const tenants = await query<PlatformTenantRow>(
    `SELECT t.*,
            (SELECT COUNT(*)::text FROM sites s WHERE s.tenant_id = t.id) AS sites_count,
            (SELECT COUNT(*)::text FROM tenant_users u WHERE u.tenant_id = t.id) AS users_count,
            COALESCE(u.conversations_count, 0)::text AS conversations_count,
            COALESCE(u.tokens_used, 0)::text AS tokens_used
     FROM tenants t
     LEFT JOIN usage_records u ON u.tenant_id = t.id AND u.period_start = $1
     ${listWhere}
     ORDER BY t.created_at DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    [periodStart, ...filters, limit, offset],
  );

  return {
    tenants,
    total: parseInt(countRow?.count ?? '0', 10),
  };
}

export async function getTenantDetail(tenantId: string) {
  const periodStart = currentPeriodStart();
  const tenant = await queryOne<PlatformTenantRow>(
    `SELECT t.*,
            (SELECT COUNT(*)::text FROM sites s WHERE s.tenant_id = t.id) AS sites_count,
            (SELECT COUNT(*)::text FROM tenant_users u WHERE u.tenant_id = t.id) AS users_count,
            COALESCE(u.conversations_count, 0)::text AS conversations_count,
            COALESCE(u.tokens_used, 0)::text AS tokens_used
     FROM tenants t
     LEFT JOIN usage_records u ON u.tenant_id = t.id AND u.period_start = $2
     WHERE t.id = $1`,
    [tenantId, periodStart],
  );
  if (!tenant) throw new AppError('Tenant not found', 404, 'NOT_FOUND');

  const users = await query<TenantUser>(
    `SELECT id, tenant_id, email, role, created_at
     FROM tenant_users WHERE tenant_id = $1 ORDER BY created_at ASC`,
    [tenantId],
  );

  const sites = await query<{
    id: string;
    name: string;
    domain: string;
    created_at: string;
  }>(
    `SELECT id, name, domain, created_at FROM sites WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId],
  );

  const overrides = await query<{ feature_key: string; enabled: boolean }>(
    `SELECT feature_key, enabled FROM tenant_feature_overrides WHERE tenant_id = $1`,
    [tenantId],
  );

  return { tenant, users, sites, feature_overrides: overrides };
}

export async function updateTenant(
  tenantId: string,
  patch: {
    plan?: Plan;
    plan_limits?: PlanLimits;
    status?: TenantStatus;
    notes?: string | null;
  },
): Promise<PlatformTenantRow> {
  const current = await queryOne<{ id: string }>(
    `SELECT id FROM tenants WHERE id = $1`,
    [tenantId],
  );
  if (!current) throw new AppError('Tenant not found', 404, 'NOT_FOUND');

  const sets: string[] = ['updated_at = now()'];
  const params: unknown[] = [];
  let i = 1;

  if (patch.plan !== undefined) {
    sets.push(`plan = $${i++}`);
    params.push(patch.plan);
  }
  if (patch.plan_limits !== undefined) {
    sets.push(`plan_limits = $${i++}`);
    params.push(JSON.stringify(patch.plan_limits));
  }
  if (patch.status !== undefined) {
    sets.push(`status = $${i++}`);
    params.push(patch.status);
  }
  if (patch.notes !== undefined) {
    sets.push(`notes = $${i++}`);
    params.push(patch.notes);
  }

  params.push(tenantId);
  const row = await queryOne<PlatformTenantRow>(
    `UPDATE tenants SET ${sets.join(', ')} WHERE id = $${i}
     RETURNING *,
       '0' AS sites_count, '0' AS users_count, '0' AS conversations_count, '0' AS tokens_used`,
    params,
  );
  if (!row) throw new AppError('Tenant not found', 404, 'NOT_FOUND');
  return row;
}

export async function listPlans(): Promise<PlatformPlan[]> {
  return query<PlatformPlan>(
    `SELECT * FROM platform_plans ORDER BY sort_order ASC`,
  );
}

export async function updatePlan(
  planId: Plan,
  patch: {
    name?: string;
    description?: string | null;
    plan_limits?: PlanLimits;
    stripe_price_id?: string | null;
    is_public?: boolean;
    sort_order?: number;
  },
): Promise<PlatformPlan> {
  const sets: string[] = ['updated_at = now()'];
  const params: unknown[] = [];
  let i = 1;

  if (patch.name !== undefined) {
    sets.push(`name = $${i++}`);
    params.push(patch.name);
  }
  if (patch.description !== undefined) {
    sets.push(`description = $${i++}`);
    params.push(patch.description);
  }
  if (patch.plan_limits !== undefined) {
    sets.push(`plan_limits = $${i++}`);
    params.push(JSON.stringify(patch.plan_limits));
  }
  if (patch.stripe_price_id !== undefined) {
    sets.push(`stripe_price_id = $${i++}`);
    params.push(patch.stripe_price_id);
  }
  if (patch.is_public !== undefined) {
    sets.push(`is_public = $${i++}`);
    params.push(patch.is_public);
  }
  if (patch.sort_order !== undefined) {
    sets.push(`sort_order = $${i++}`);
    params.push(patch.sort_order);
  }

  params.push(planId);
  const row = await queryOne<PlatformPlan>(
    `UPDATE platform_plans SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    params,
  );
  if (!row) throw new AppError('Plan not found', 404, 'NOT_FOUND');
  return row;
}

/** Apply catalog limits to all tenants currently on this plan (optional sync). */
export async function syncPlanLimitsToTenants(planId: Plan): Promise<number> {
  const plan = await queryOne<PlatformPlan>(
    `SELECT * FROM platform_plans WHERE id = $1`,
    [planId],
  );
  if (!plan) throw new AppError('Plan not found', 404, 'NOT_FOUND');

  const result = await queryOne<{ count: string }>(
    `WITH updated AS (
       UPDATE tenants SET plan_limits = $2, updated_at = now()
       WHERE plan = $1
       RETURNING id
     )
     SELECT COUNT(*)::text AS count FROM updated`,
    [planId, JSON.stringify(plan.plan_limits)],
  );
  return parseInt(result?.count ?? '0', 10);
}

export async function listSettings(): Promise<PlatformSetting[]> {
  return query<PlatformSetting>(
    `SELECT key, value, description, updated_at, updated_by FROM platform_settings ORDER BY key ASC`,
  );
}

export async function updateSetting(
  key: string,
  value: unknown,
  updatedBy: string | null,
): Promise<PlatformSetting> {
  const row = await queryOne<PlatformSetting>(
    `UPDATE platform_settings
     SET value = $2, updated_at = now(), updated_by = $3
     WHERE key = $1
     RETURNING key, value, description, updated_at, updated_by`,
    [key, JSON.stringify(value), updatedBy],
  );
  if (!row) throw new AppError('Setting not found', 404, 'NOT_FOUND');
  return row;
}

export async function getSettingValue<T = unknown>(key: string): Promise<T | null> {
  const row = await queryOne<{ value: T }>(
    `SELECT value FROM platform_settings WHERE key = $1`,
    [key],
  );
  return row ? row.value : null;
}

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  return query<FeatureFlag>(
    `SELECT key, name, description, enabled, plans, updated_at FROM feature_flags ORDER BY key ASC`,
  );
}

export async function updateFeatureFlag(
  key: string,
  patch: { enabled?: boolean; plans?: Plan[]; name?: string; description?: string | null },
): Promise<FeatureFlag> {
  const sets: string[] = ['updated_at = now()'];
  const params: unknown[] = [];
  let i = 1;

  if (patch.enabled !== undefined) {
    sets.push(`enabled = $${i++}`);
    params.push(patch.enabled);
  }
  if (patch.plans !== undefined) {
    sets.push(`plans = $${i++}`);
    params.push(patch.plans);
  }
  if (patch.name !== undefined) {
    sets.push(`name = $${i++}`);
    params.push(patch.name);
  }
  if (patch.description !== undefined) {
    sets.push(`description = $${i++}`);
    params.push(patch.description);
  }

  params.push(key);
  const row = await queryOne<FeatureFlag>(
    `UPDATE feature_flags SET ${sets.join(', ')} WHERE key = $${i}
     RETURNING key, name, description, enabled, plans, updated_at`,
    params,
  );
  if (!row) throw new AppError('Feature flag not found', 404, 'NOT_FOUND');
  return row;
}

export async function setTenantFeatureOverride(
  tenantId: string,
  featureKey: string,
  enabled: boolean | null,
): Promise<void> {
  if (enabled === null) {
    await query(
      `DELETE FROM tenant_feature_overrides WHERE tenant_id = $1 AND feature_key = $2`,
      [tenantId, featureKey],
    );
    return;
  }
  await query(
    `INSERT INTO tenant_feature_overrides (tenant_id, feature_key, enabled, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (tenant_id, feature_key)
     DO UPDATE SET enabled = $3, updated_at = now()`,
    [tenantId, featureKey, enabled],
  );
}

export async function listAuditLog(opts: {
  limit?: number;
  offset?: number;
}): Promise<{ entries: AdminAuditEntry[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM admin_audit_log`,
  );
  const entries = await query<AdminAuditEntry>(
    `SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return { entries, total: parseInt(countRow?.count ?? '0', 10) };
}
