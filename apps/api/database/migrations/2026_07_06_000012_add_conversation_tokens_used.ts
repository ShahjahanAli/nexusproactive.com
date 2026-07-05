import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS tokens_used INT NOT NULL DEFAULT 0
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`ALTER TABLE conversations DROP COLUMN IF EXISTS tokens_used`);
}
