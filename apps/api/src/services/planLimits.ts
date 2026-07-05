import {
  DEFAULT_PLAN_LIMITS,
  Plan,
  PlanLimitCheckResult,
  PlanLimitMetric,
  PlanLimits,
} from '@nexus/shared-types';
import { queryOne } from '../db';

interface TenantRow {
  plan: Plan;
  plan_limits: PlanLimits;
}

function currentPeriodStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

async function getTenantPlan(tenantId: string): Promise<{ plan: Plan; limits: PlanLimits }> {
  const row = await queryOne<TenantRow>(
    'SELECT plan, plan_limits FROM tenants WHERE id = $1',
    [tenantId],
  );
  if (!row) {
    throw new Error('Tenant not found');
  }
  const limits = row.plan_limits ?? DEFAULT_PLAN_LIMITS[row.plan];
  return { plan: row.plan, limits };
}

async function getCurrentUsage(tenantId: string): Promise<{
  conversations_count: number;
  tokens_used: number;
}> {
  const periodStart = currentPeriodStart();
  const row = await queryOne<{ conversations_count: number; tokens_used: string }>(
    `SELECT conversations_count, tokens_used FROM usage_records
     WHERE tenant_id = $1 AND period_start = $2`,
    [tenantId, periodStart],
  );
  return {
    conversations_count: row?.conversations_count ?? 0,
    tokens_used: row ? Number(row.tokens_used) : 0,
  };
}

async function getSiteCount(tenantId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM sites WHERE tenant_id = $1',
    [tenantId],
  );
  return row ? parseInt(row.count, 10) : 0;
}

const CAPACITY_MESSAGE =
  'This business has reached its support capacity. Please try again later or contact the site owner.';

export async function checkPlanLimit(
  tenantId: string,
  metric: PlanLimitMetric,
): Promise<PlanLimitCheckResult> {
  const { limits } = await getTenantPlan(tenantId);

  if (metric === 'max_sites') {
    const current = await getSiteCount(tenantId);
    const limit = limits.max_sites;
    return {
      allowed: current < limit,
      metric,
      current,
      limit,
      message: current >= limit ? CAPACITY_MESSAGE : undefined,
    };
  }

  const usage = await getCurrentUsage(tenantId);

  if (metric === 'max_conversations_month') {
    const current = usage.conversations_count;
    const limit = limits.max_conversations_month;
    return {
      allowed: current < limit,
      metric,
      current,
      limit,
      message: current >= limit ? CAPACITY_MESSAGE : undefined,
    };
  }

  const current = usage.tokens_used;
  const limit = limits.max_tokens_month;
  return {
    allowed: current < limit,
    metric,
    current,
    limit,
    message: current >= limit ? CAPACITY_MESSAGE : undefined,
  };
}

export async function incrementUsage(
  tenantId: string,
  field: 'conversations_count' | 'tokens_used',
  amount = 1,
): Promise<void> {
  const periodStart = currentPeriodStart();
  await queryOne(
    `INSERT INTO usage_records (tenant_id, period_start, ${field})
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, period_start)
     DO UPDATE SET ${field} = usage_records.${field} + $3`,
    [tenantId, periodStart, amount],
  );
}

export { getTenantPlan, getCurrentUsage, getSiteCount, CAPACITY_MESSAGE };
