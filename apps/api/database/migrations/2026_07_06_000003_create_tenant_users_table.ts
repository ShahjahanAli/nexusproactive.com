import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE tenant_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT CHECK (role IN ('owner','admin','viewer')) DEFAULT 'admin',
      password_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(tenant_id, email)
    )
  `);
  await client.query(
    `CREATE INDEX idx_tenant_users_email ON tenant_users(email)`,
  );
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS tenant_users`);
}
