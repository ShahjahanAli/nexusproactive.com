import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
      operation_id TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      description TEXT,
      input_schema JSONB,
      risk_tier TEXT CHECK (risk_tier IN ('read_only','reversible_write','irreversible_write','financial')),
      compensating_action_id UUID REFERENCES actions(id),
      spec_version INT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      reviewed_by_human BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(site_id, operation_id, spec_version)
    )
  `);
  await client.query(`CREATE INDEX idx_actions_site_id ON actions(site_id)`);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS actions`);
}
