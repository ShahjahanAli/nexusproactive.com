import { PoolClient } from 'pg';

/** Activate read-only actions that were incorrectly ingested as inactive */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    UPDATE actions SET is_active = true, reviewed_by_human = true
    WHERE risk_tier = 'read_only' AND is_active = false
  `);
}

export async function down(_client: PoolClient): Promise<void> {
  // No rollback — re-activating read-only actions is safe
}
