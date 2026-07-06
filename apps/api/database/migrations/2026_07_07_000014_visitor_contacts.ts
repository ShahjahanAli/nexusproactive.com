import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS visitor_contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL,
      name TEXT,
      email TEXT,
      phone TEXT,
      country TEXT,
      company TEXT,
      consent_given BOOLEAN DEFAULT false,
      consent_at TIMESTAMPTZ,
      source TEXT DEFAULT 'chat',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (site_id, visitor_id)
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_visitor_contacts_lookup ON visitor_contacts(site_id, visitor_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_visitor_contacts_email ON visitor_contacts(site_id, email) WHERE email IS NOT NULL`,
  );
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS visitor_contacts`);
}
