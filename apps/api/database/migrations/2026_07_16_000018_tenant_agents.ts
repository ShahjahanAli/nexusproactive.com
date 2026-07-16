import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE tenant_users DROP CONSTRAINT IF EXISTS tenant_users_role_check
  `);
  await client.query(`
    ALTER TABLE tenant_users
      ADD CONSTRAINT tenant_users_role_check
      CHECK (role IN ('owner', 'admin', 'agent', 'viewer'))
  `);
  await client.query(`
    ALTER TABLE tenant_users
      ADD COLUMN IF NOT EXISTS display_name TEXT,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    UPDATE tenant_users SET role = 'viewer' WHERE role = 'agent'
  `);
  await client.query(`
    ALTER TABLE tenant_users DROP CONSTRAINT IF EXISTS tenant_users_role_check
  `);
  await client.query(`
    ALTER TABLE tenant_users
      ADD CONSTRAINT tenant_users_role_check
      CHECK (role IN ('owner', 'admin', 'viewer'))
  `);
  await client.query(`
    ALTER TABLE tenant_users
      DROP COLUMN IF EXISTS display_name,
      DROP COLUMN IF EXISTS is_active
  `);
}
