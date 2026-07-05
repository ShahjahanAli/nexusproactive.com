import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES tenant_users(id),
    ADD COLUMN IF NOT EXISTS escalation_reason TEXT
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS visitor_memories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL,
      fact TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      source TEXT DEFAULT 'system',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_visitor_memories_lookup ON visitor_memories(site_id, visitor_id)`,
  );

  await client.query(`
    CREATE TABLE IF NOT EXISTS visitor_identity_aliases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
      alias_visitor_id TEXT NOT NULL,
      canonical_visitor_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(site_id, alias_visitor_id)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events TEXT[] NOT NULL DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_tenant ON webhook_subscriptions(tenant_id)`,
  );

  await client.query(`
    CREATE TABLE IF NOT EXISTS proactive_triggers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      conditions JSONB NOT NULL DEFAULT '{}',
      message_template TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_proactive_triggers_site ON proactive_triggers(site_id)`,
  );

  await client.query(`
    CREATE TABLE IF NOT EXISTS visitor_context (
      site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL,
      page_url TEXT,
      page_title TEXT,
      idle_seconds INT DEFAULT 0,
      metadata JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (site_id, visitor_id)
    )
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS visitor_context`);
  await client.query(`DROP TABLE IF EXISTS proactive_triggers`);
  await client.query(`DROP TABLE IF EXISTS webhook_subscriptions`);
  await client.query(`DROP TABLE IF EXISTS visitor_identity_aliases`);
  await client.query(`DROP TABLE IF EXISTS visitor_memories`);
  await client.query(`
    ALTER TABLE conversations
    DROP COLUMN IF EXISTS escalation_reason,
    DROP COLUMN IF EXISTS assigned_to,
    DROP COLUMN IF EXISTS escalated_at
  `);
}
