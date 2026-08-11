import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS detected_language TEXT,
      ADD COLUMN IF NOT EXISTS handoff_brief TEXT
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE conversations
      DROP COLUMN IF EXISTS handoff_brief,
      DROP COLUMN IF EXISTS detected_language
  `);
}
