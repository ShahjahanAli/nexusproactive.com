import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE usage_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      period_start DATE NOT NULL,
      conversations_count INT DEFAULT 0,
      tokens_used BIGINT DEFAULT 0,
      UNIQUE(tenant_id, period_start)
    )
  `);
  await client.query(
    `CREATE INDEX idx_usage_records_tenant_period ON usage_records(tenant_id, period_start)`,
  );
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS usage_records`);
}
