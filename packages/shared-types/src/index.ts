export type Plan = 'trial' | 'starter' | 'growth' | 'scale';

export type TenantRole = 'owner' | 'admin' | 'viewer';

export type RiskTier =
  | 'read_only'
  | 'reversible_write'
  | 'irreversible_write'
  | 'financial';

export interface PlanLimits {
  max_sites: number;
  max_conversations_month: number;
  max_tokens_month: number;
}

export const DEFAULT_PLAN_LIMITS: Record<Plan, PlanLimits> = {
  trial: {
    max_sites: 1,
    max_conversations_month: 500,
    max_tokens_month: 2_000_000,
  },
  starter: {
    max_sites: 1,
    max_conversations_month: 2_000,
    max_tokens_month: 5_000_000,
  },
  growth: {
    max_sites: 5,
    max_conversations_month: 10_000,
    max_tokens_month: 20_000_000,
  },
  scale: {
    max_sites: 25,
    max_conversations_month: 100_000,
    max_tokens_month: 100_000_000,
  },
};

export interface Tenant {
  id: string;
  company_name: string;
  owner_email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: Plan;
  plan_limits: PlanLimits;
  created_at: string;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  email: string;
  role: TenantRole;
  created_at: string;
}

export interface Site {
  id: string;
  tenant_id: string;
  name: string;
  domain: string;
  backend_base_url: string;
  openapi_spec_url: string | null;
  widget_theme: Record<string, unknown>;
  created_at: string;
}

export interface Action {
  id: string;
  site_id: string;
  operation_id: string;
  method: string;
  path: string;
  description: string | null;
  input_schema: Record<string, unknown> | null;
  risk_tier: RiskTier;
  compensating_action_id: string | null;
  spec_version: number;
  is_active: boolean;
  reviewed_by_human: boolean;
  created_at: string;
}

export interface AuthUser {
  userId: string;
  tenantId: string;
  email: string;
  role: TenantRole;
  companyName: string;
  plan: Plan;
  planLimits: PlanLimits;
}

export interface SignupRequest {
  companyName: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type PlanLimitMetric =
  | 'max_sites'
  | 'max_conversations_month'
  | 'max_tokens_month';

export interface PlanLimitCheckResult {
  allowed: boolean;
  metric: PlanLimitMetric;
  current: number;
  limit: number;
  message?: string;
}

export interface ApiError {
  error: string;
  code?: string;
}
