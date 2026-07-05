import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE sites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      backend_base_url TEXT NOT NULL,
      openapi_spec_url TEXT,
      jwt_signing_secret TEXT NOT NULL,
      widget_theme JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await client.query(`CREATE INDEX idx_sites_tenant_id ON sites(tenant_id)`);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS sites`);
}
