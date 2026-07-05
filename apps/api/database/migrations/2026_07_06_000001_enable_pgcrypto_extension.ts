import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP EXTENSION IF EXISTS "pgcrypto"`);
}
