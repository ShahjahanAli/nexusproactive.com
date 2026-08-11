import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS cx_agents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'paused')),
      role_summary TEXT,
      tone TEXT,
      system_prompt TEXT,
      max_concurrent_chats INT NOT NULL DEFAULT 5
        CHECK (max_concurrent_chats >= 1 AND max_concurrent_chats <= 200),
      allowed_specialists TEXT[] NOT NULL DEFAULT ARRAY['billing','technical','sales','account'],
      sales_goals JSONB NOT NULL DEFAULT '{}',
      rating_policy JSONB NOT NULL DEFAULT '{"ask_after_resolve":true,"scale":5}',
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, slug)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_cx_agents_tenant_status
      ON cx_agents (tenant_id, status)
  `);

  await client.query(`
    ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS cx_agent_id UUID REFERENCES cx_agents(id) ON DELETE SET NULL
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_conversations_cx_agent
      ON conversations (cx_agent_id)
      WHERE cx_agent_id IS NOT NULL
  `);

  // Merge CX defaults into existing plan catalog rows (JSONB).
  await client.query(`
    UPDATE platform_plans SET plan_limits = plan_limits || jsonb_build_object(
      'cx_agents_enabled', true,
      'max_cx_agents', CASE id
        WHEN 'trial' THEN 1
        WHEN 'starter' THEN 2
        WHEN 'growth' THEN 5
        WHEN 'scale' THEN 15
        ELSE 1 END,
      'default_max_concurrent_chats', CASE id
        WHEN 'trial' THEN 3
        WHEN 'starter' THEN 5
        WHEN 'growth' THEN 10
        WHEN 'scale' THEN 20
        ELSE 5 END,
      'max_concurrent_chats_cap', CASE id
        WHEN 'trial' THEN 5
        WHEN 'starter' THEN 10
        WHEN 'growth' THEN 25
        WHEN 'scale' THEN 50
        ELSE 10 END,
      'cx_peer_consult_enabled', (id IN ('growth','scale')),
      'cx_specialist_consult_enabled', true,
      'cx_ratings_enabled', true,
      'cx_leaderboard_enabled', true,
      'cx_live_graph_enabled', true,
      'cx_knowledge_items_cap', CASE id
        WHEN 'trial' THEN 50
        WHEN 'starter' THEN 100
        WHEN 'growth' THEN 500
        WHEN 'scale' THEN 2000
        ELSE 50 END
    ),
    updated_at = now()
  `);

  // Best-effort: merge CX defaults onto existing tenant plan_limits without wiping overrides.
  await client.query(`
    UPDATE tenants SET plan_limits = plan_limits || jsonb_build_object(
      'cx_agents_enabled', COALESCE((plan_limits->>'cx_agents_enabled')::boolean, true),
      'max_cx_agents', COALESCE((plan_limits->>'max_cx_agents')::int,
        CASE plan
          WHEN 'trial' THEN 1 WHEN 'starter' THEN 2
          WHEN 'growth' THEN 5 WHEN 'scale' THEN 15 ELSE 1 END),
      'default_max_concurrent_chats', COALESCE((plan_limits->>'default_max_concurrent_chats')::int,
        CASE plan
          WHEN 'trial' THEN 3 WHEN 'starter' THEN 5
          WHEN 'growth' THEN 10 WHEN 'scale' THEN 20 ELSE 5 END),
      'max_concurrent_chats_cap', COALESCE((plan_limits->>'max_concurrent_chats_cap')::int,
        CASE plan
          WHEN 'trial' THEN 5 WHEN 'starter' THEN 10
          WHEN 'growth' THEN 25 WHEN 'scale' THEN 50 ELSE 10 END),
      'cx_peer_consult_enabled', COALESCE((plan_limits->>'cx_peer_consult_enabled')::boolean, plan IN ('growth','scale')),
      'cx_specialist_consult_enabled', COALESCE((plan_limits->>'cx_specialist_consult_enabled')::boolean, true),
      'cx_ratings_enabled', COALESCE((plan_limits->>'cx_ratings_enabled')::boolean, true),
      'cx_leaderboard_enabled', COALESCE((plan_limits->>'cx_leaderboard_enabled')::boolean, true),
      'cx_live_graph_enabled', COALESCE((plan_limits->>'cx_live_graph_enabled')::boolean, true),
      'cx_knowledge_items_cap', COALESCE((plan_limits->>'cx_knowledge_items_cap')::int,
        CASE plan
          WHEN 'trial' THEN 50 WHEN 'starter' THEN 100
          WHEN 'growth' THEN 500 WHEN 'scale' THEN 2000 ELSE 50 END)
    )
  `);

  await client.query(`
    INSERT INTO feature_flags (key, name, description, enabled, plans)
    VALUES (
      'cx_agents',
      'CX Agents',
      'Tenant-owned Customer Experience AI agents with capacity, wizard setup, and specialist consults',
      true,
      ARRAY['trial','starter','growth','scale']
    )
    ON CONFLICT (key) DO NOTHING
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DELETE FROM feature_flags WHERE key = 'cx_agents'`);
  await client.query(`
    ALTER TABLE conversations DROP COLUMN IF EXISTS cx_agent_id
  `);
  await client.query(`DROP TABLE IF EXISTS cx_agents`);
}
