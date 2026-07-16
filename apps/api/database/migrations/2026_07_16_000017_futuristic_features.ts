import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS mission_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed', 'cancelled', 'failed')),
      steps JSONB NOT NULL DEFAULT '[]'::jsonb,
      current_step INT NOT NULL DEFAULT 0,
      title TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_mission_plans_conversation ON mission_plans(conversation_id)`,
  );

  await client.query(`
    CREATE TABLE IF NOT EXISTS action_health_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      action_id UUID REFERENCES actions(id) ON DELETE SET NULL,
      operation_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning'
        CHECK (severity IN ('info', 'warning', 'critical')),
      suggestion TEXT,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_action_health_events_site ON action_health_events(site_id, created_at DESC)`,
  );

  await client.query(`
    ALTER TABLE product_signals
      ADD COLUMN IF NOT EXISTS suggested_endpoint JSONB,
      ADD COLUMN IF NOT EXISTS suggestion_status TEXT DEFAULT 'none'
  `);

  await client.query(`
    ALTER TABLE action_executions
      ADD COLUMN IF NOT EXISTS http_status INT,
      ADD COLUMN IF NOT EXISTS error_message TEXT
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE action_executions
      DROP COLUMN IF EXISTS http_status,
      DROP COLUMN IF EXISTS error_message
  `);
  await client.query(`
    ALTER TABLE product_signals
      DROP COLUMN IF EXISTS suggested_endpoint,
      DROP COLUMN IF EXISTS suggestion_status
  `);
  await client.query(`DROP TABLE IF EXISTS action_health_events`);
  await client.query(`DROP TABLE IF EXISTS mission_plans`);
  await client.query(`ALTER TABLE messages DROP COLUMN IF EXISTS meta`);
}
