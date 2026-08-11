export type Plan = 'trial' | 'starter' | 'growth' | 'scale';

export type TenantRole = 'owner' | 'admin' | 'agent' | 'viewer';

export type TenantStatus = 'active' | 'suspended' | 'churned';

export type PlatformRole = 'super_admin' | 'support' | 'readonly';

export type RiskTier =
  | 'read_only'
  | 'reversible_write'
  | 'irreversible_write'
  | 'financial';

export type CxSpecialist = 'billing' | 'technical' | 'sales' | 'account';

export type CxAgentStatus = 'draft' | 'active' | 'paused';

/** Limits stored on platform_plans / tenants.plan_limits (JSONB). */
export interface PlanLimits {
  max_sites: number;
  max_conversations_month: number;
  max_tokens_month: number;
  /** CX Agents feature (tenant-owned AI personas). */
  cx_agents_enabled?: boolean;
  max_cx_agents?: number;
  default_max_concurrent_chats?: number;
  max_concurrent_chats_cap?: number;
  cx_peer_consult_enabled?: boolean;
  cx_specialist_consult_enabled?: boolean;
  cx_ratings_enabled?: boolean;
  cx_leaderboard_enabled?: boolean;
  cx_live_graph_enabled?: boolean;
  cx_knowledge_items_cap?: number;
}

export const DEFAULT_PLAN_LIMITS: Record<Plan, PlanLimits> = {
  trial: {
    max_sites: 1,
    max_conversations_month: 500,
    max_tokens_month: 2_000_000,
    cx_agents_enabled: true,
    max_cx_agents: 1,
    default_max_concurrent_chats: 3,
    max_concurrent_chats_cap: 5,
    cx_peer_consult_enabled: false,
    cx_specialist_consult_enabled: true,
    cx_ratings_enabled: true,
    cx_leaderboard_enabled: true,
    cx_live_graph_enabled: true,
    cx_knowledge_items_cap: 50,
  },
  starter: {
    max_sites: 1,
    max_conversations_month: 2_000,
    max_tokens_month: 5_000_000,
    cx_agents_enabled: true,
    max_cx_agents: 2,
    default_max_concurrent_chats: 5,
    max_concurrent_chats_cap: 10,
    cx_peer_consult_enabled: false,
    cx_specialist_consult_enabled: true,
    cx_ratings_enabled: true,
    cx_leaderboard_enabled: true,
    cx_live_graph_enabled: true,
    cx_knowledge_items_cap: 100,
  },
  growth: {
    max_sites: 5,
    max_conversations_month: 10_000,
    max_tokens_month: 20_000_000,
    cx_agents_enabled: true,
    max_cx_agents: 5,
    default_max_concurrent_chats: 10,
    max_concurrent_chats_cap: 25,
    cx_peer_consult_enabled: true,
    cx_specialist_consult_enabled: true,
    cx_ratings_enabled: true,
    cx_leaderboard_enabled: true,
    cx_live_graph_enabled: true,
    cx_knowledge_items_cap: 500,
  },
  scale: {
    max_sites: 25,
    max_conversations_month: 100_000,
    max_tokens_month: 100_000_000,
    cx_agents_enabled: true,
    max_cx_agents: 15,
    default_max_concurrent_chats: 20,
    max_concurrent_chats_cap: 50,
    cx_peer_consult_enabled: true,
    cx_specialist_consult_enabled: true,
    cx_ratings_enabled: true,
    cx_leaderboard_enabled: true,
    cx_live_graph_enabled: true,
    cx_knowledge_items_cap: 2000,
  },
};

export interface CxAgent {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  display_name: string;
  avatar_url: string | null;
  status: CxAgentStatus;
  role_summary: string | null;
  tone: string | null;
  system_prompt: string | null;
  max_concurrent_chats: number;
  allowed_specialists: CxSpecialist[];
  sales_goals: Record<string, unknown>;
  rating_policy: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
  /** Present on list endpoints */
  active_chats?: number;
}

export type CxConsultType = 'specialist' | 'peer_cx' | 'human';
export type CxConsultStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout';

export interface CxConsult {
  id: string;
  tenant_id: string;
  conversation_id: string;
  from_cx_agent_id: string;
  consult_type: CxConsultType;
  target_key: string;
  question: string;
  context_snippet: string | null;
  answer: string | null;
  status: CxConsultStatus;
  tokens_used: number;
  latency_ms: number | null;
  meta: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

export interface CxKnowledgeItem {
  id: string;
  tenant_id: string;
  cx_agent_id: string | null;
  title: string;
  body: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CxAgentRating {
  id: string;
  tenant_id: string;
  conversation_id: string;
  cx_agent_id: string;
  visitor_id: string;
  score: number;
  comment: string | null;
  created_at: string;
}

export interface CxSalesEvent {
  id: string;
  tenant_id: string;
  conversation_id: string;
  cx_agent_id: string;
  event_type: string;
  detail: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface CxSalesGoals {
  pitch?: string;
  soft?: boolean;
  cta?: string;
  products?: string;
}

export interface CxRatingPolicy {
  ask_after_resolve?: boolean;
  ask_after_messages?: number;
  scale?: number;
  allow_comment?: boolean;
}

export interface Tenant {
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
  updated_at?: string | null;
}

export interface PlatformAdmin {
  id: string;
  email: string;
  name: string | null;
  role: PlatformRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface PlatformAuthUser {
  adminId: string;
  email: string;
  name: string | null;
  role: PlatformRole;
}

export interface PlatformPlan {
  id: Plan;
  name: string;
  description: string | null;
  plan_limits: PlanLimits;
  stripe_price_id: string | null;
  is_public: boolean;
  sort_order: number;
  updated_at: string;
}

export interface PlatformSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface FeatureFlag {
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  plans: Plan[];
  updated_at: string;
}

export interface OpenApiSourceTypeRouting {
  specialists?: Array<'billing' | 'technical' | 'sales' | 'account'>;
  alwaysInclude?: boolean;
}

export interface OpenApiSourceType {
  key: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  routing: OpenApiSourceTypeRouting;
  created_at: string;
  updated_at: string;
}

export interface SiteOpenApiSource {
  id: string;
  site_id: string;
  type_key: string;
  label: string | null;
  url: string;
  backend_base_url: string | null;
  is_enabled: boolean;
  last_ingested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from openapi_source_types when available */
  type_name?: string | null;
}

export interface AdminAuditEntry {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface PlatformOverviewStats {
  tenants_total: number;
  tenants_active: number;
  tenants_suspended: number;
  sites_total: number;
  conversations_month: number;
  tokens_month: number;
  by_plan: Record<Plan, number>;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  email: string;
  role: TenantRole;
  display_name?: string | null;
  is_active?: boolean;
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
  source_id?: string | null;
  source_type?: string | null;
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
  | 'max_tokens_month'
  | 'max_cx_agents';

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
