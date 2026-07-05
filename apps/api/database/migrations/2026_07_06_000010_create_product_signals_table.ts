import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE product_signals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
      cluster_label TEXT,
      representative_message TEXT,
      occurrence_count INT DEFAULT 1,
      first_seen TIMESTAMPTZ DEFAULT now(),
      last_seen TIMESTAMPTZ DEFAULT now(),
      status TEXT DEFAULT 'new'
    )
  `);
  await client.query(
    `CREATE INDEX idx_product_signals_site_id ON product_signals(site_id)`,
  );
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS product_signals`);
}
