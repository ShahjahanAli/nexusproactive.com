import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS cx_agent_knowledge (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      cx_agent_id UUID REFERENCES cx_agents(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'faq',
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_cx_knowledge_tenant
      ON cx_agent_knowledge (tenant_id, is_active)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_cx_knowledge_agent
      ON cx_agent_knowledge (cx_agent_id)
      WHERE cx_agent_id IS NOT NULL
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS cx_agent_ratings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      cx_agent_id UUID NOT NULL REFERENCES cx_agents(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL,
      score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 5),
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (conversation_id)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_cx_ratings_agent
      ON cx_agent_ratings (cx_agent_id, created_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS cx_sales_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      cx_agent_id UUID NOT NULL REFERENCES cx_agents(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      detail TEXT,
      meta JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_cx_sales_agent
      ON cx_sales_events (cx_agent_id, created_at DESC)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_cx_sales_conversation
      ON cx_sales_events (conversation_id)
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS cx_sales_events`);
  await client.query(`DROP TABLE IF EXISTS cx_agent_ratings`);
  await client.query(`DROP TABLE IF EXISTS cx_agent_knowledge`);
}
