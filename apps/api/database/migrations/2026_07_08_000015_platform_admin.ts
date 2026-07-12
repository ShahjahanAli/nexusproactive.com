import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE platform_admins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL CHECK (role IN ('super_admin','support','readonly')) DEFAULT 'super_admin',
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL
        CHECK (status IN ('active','suspended','churned')) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()
  `);

  await client.query(`
    CREATE TABLE platform_plans (
      id TEXT PRIMARY KEY CHECK (id IN ('trial','starter','growth','scale')),
      name TEXT NOT NULL,
      description TEXT,
      plan_limits JSONB NOT NULL,
      stripe_price_id TEXT,
      is_public BOOLEAN NOT NULL DEFAULT true,
      sort_order INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    INSERT INTO platform_plans (id, name, description, plan_limits, is_public, sort_order)
    VALUES
      ('trial', 'Trial', 'Evaluation tier with limited capacity',
        '{"max_sites":1,"max_conversations_month":500,"max_tokens_month":2000000}', true, 0),
      ('starter', 'Starter', 'Single-site production deployments',
        '{"max_sites":1,"max_conversations_month":2000,"max_tokens_month":5000000}', true, 1),
      ('growth', 'Growth', 'Multi-site teams scaling usage',
        '{"max_sites":5,"max_conversations_month":10000,"max_tokens_month":20000000}', true, 2),
      ('scale', 'Scale', 'High-capacity enterprise deployments',
        '{"max_sites":25,"max_conversations_month":100000,"max_tokens_month":100000000}', true, 3)
  `);

  await client.query(`
    CREATE TABLE platform_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}',
      description TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by UUID REFERENCES platform_admins(id) ON DELETE SET NULL
    )
  `);

  await client.query(`
    INSERT INTO platform_settings (key, value, description)
    VALUES
      ('maintenance_mode', 'false', 'When true, tenant APIs return a maintenance response'),
      ('allow_signups', 'true', 'Allow new tenant self-service signups'),
      ('default_plan', '"trial"', 'Plan assigned to new tenants on signup'),
      ('support_email', '"support@nexusproactive.com"', 'Public support contact email'),
      ('widget_min_version', '"1.0.0"', 'Minimum recommended widget script version')
  `);

  await client.query(`
    CREATE TABLE feature_flags (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      enabled BOOLEAN NOT NULL DEFAULT false,
      plans TEXT[] NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    INSERT INTO feature_flags (key, name, description, enabled, plans)
    VALUES
      ('escalations', 'Human Escalations', 'Route unresolved chats to a human inbox', true,
        ARRAY['trial','starter','growth','scale']),
      ('webhooks', 'Outbound Webhooks', 'Emit conversation and action events to tenant endpoints', true,
        ARRAY['growth','scale']),
      ('proactive_triggers', 'Proactive Triggers', 'Fire chat prompts from visitor behavior signals', true,
        ARRAY['growth','scale']),
      ('visitor_memory', 'Visitor Memory', 'Persist cross-session visitor context', true,
        ARRAY['starter','growth','scale']),
      ('action_graph', 'Action Graph', 'OpenAPI discovery and risk-tiered tool calling', true,
        ARRAY['trial','starter','growth','scale'])
  `);

  await client.query(`
    CREATE TABLE tenant_feature_overrides (
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      feature_key TEXT NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, feature_key)
    )
  `);

  await client.query(`
    CREATE TABLE admin_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
      actor_email TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      meta JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
    CREATE INDEX idx_tenants_status ON tenants (status);
    CREATE INDEX idx_tenants_plan ON tenants (plan);
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS admin_audit_log`);
  await client.query(`DROP TABLE IF EXISTS tenant_feature_overrides`);
  await client.query(`DROP TABLE IF EXISTS feature_flags`);
  await client.query(`DROP TABLE IF EXISTS platform_settings`);
  await client.query(`DROP TABLE IF EXISTS platform_plans`);
  await client.query(`
    ALTER TABLE tenants
      DROP COLUMN IF EXISTS status,
      DROP COLUMN IF EXISTS notes,
      DROP COLUMN IF EXISTS updated_at
  `);
  await client.query(`DROP TABLE IF EXISTS platform_admins`);
}
