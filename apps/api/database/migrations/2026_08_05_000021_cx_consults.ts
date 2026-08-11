import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS cx_consults (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      from_cx_agent_id UUID NOT NULL REFERENCES cx_agents(id) ON DELETE CASCADE,
      consult_type TEXT NOT NULL
        CHECK (consult_type IN ('specialist', 'peer_cx', 'human')),
      target_key TEXT NOT NULL,
      question TEXT NOT NULL,
      context_snippet TEXT,
      answer TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout')),
      tokens_used INT NOT NULL DEFAULT 0,
      latency_ms INT,
      meta JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_cx_consults_tenant_created
      ON cx_consults (tenant_id, created_at DESC)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_cx_consults_agent_created
      ON cx_consults (from_cx_agent_id, created_at DESC)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_cx_consults_conversation
      ON cx_consults (conversation_id, created_at DESC)
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS cx_consults`);
}
