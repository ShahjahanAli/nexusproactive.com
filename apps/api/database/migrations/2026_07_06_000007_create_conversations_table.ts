import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      active_agent TEXT DEFAULT 'router',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await client.query(
    `CREATE INDEX idx_conversations_site_visitor ON conversations(site_id, visitor_id)`,
  );
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS conversations`);
}
