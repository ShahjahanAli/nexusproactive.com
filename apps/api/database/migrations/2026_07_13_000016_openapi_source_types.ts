import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE openapi_source_types (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      routing JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    INSERT INTO openapi_source_types (key, name, description, sort_order, routing)
    VALUES
      ('services', 'Services', 'Service catalog and service-related endpoints', 0,
        '{"specialists":["technical","sales"],"alwaysInclude":false}'::jsonb),
      ('products', 'Products', 'Product catalog, pricing, and listings', 1,
        '{"specialists":["sales"],"alwaysInclude":false}'::jsonb),
      ('faq', 'FAQ', 'Frequently asked questions and help content', 2,
        '{"specialists":[],"alwaysInclude":true}'::jsonb),
      ('customer_info', 'Customer Info', 'Customer profiles and account data', 3,
        '{"specialists":["account","billing"],"alwaysInclude":false}'::jsonb),
      ('orders', 'Orders', 'Orders, purchases, and fulfillment', 4,
        '{"specialists":["account","billing"],"alwaysInclude":false}'::jsonb),
      ('other', 'Other', 'Uncategorized or general API endpoints', 5,
        '{"specialists":[],"alwaysInclude":true}'::jsonb)
  `);

  await client.query(`
    CREATE TABLE site_openapi_sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      type_key TEXT NOT NULL REFERENCES openapi_source_types(key) ON DELETE RESTRICT,
      label TEXT,
      url TEXT NOT NULL,
      backend_base_url TEXT,
      is_enabled BOOLEAN NOT NULL DEFAULT true,
      last_ingested_at TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (site_id, type_key, url)
    )
  `);

  await client.query(`
    CREATE INDEX idx_site_openapi_sources_site_id ON site_openapi_sources(site_id)
  `);

  await client.query(`
    ALTER TABLE actions
      ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES site_openapi_sources(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS source_type TEXT REFERENCES openapi_source_types(key) ON DELETE SET NULL
  `);

  await client.query(`
    CREATE INDEX idx_actions_source_id ON actions(source_id)
  `);

  // Backfill: one "other" source per site that already has an OpenAPI URL
  await client.query(`
    INSERT INTO site_openapi_sources (site_id, type_key, label, url, is_enabled)
    SELECT id, 'other', 'Primary OpenAPI', openapi_spec_url, true
    FROM sites
    WHERE openapi_spec_url IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM site_openapi_sources s WHERE s.site_id = sites.id
      )
  `);

  await client.query(`
    UPDATE actions a
    SET source_id = s.id,
        source_type = s.type_key
    FROM site_openapi_sources s
    WHERE a.site_id = s.site_id
      AND a.source_id IS NULL
      AND s.type_key = 'other'
  `);

  await client.query(`
    ALTER TABLE actions DROP CONSTRAINT IF EXISTS actions_site_id_operation_id_spec_version_key
  `);

  // Partial unique: typed sources always have source_id; legacy null rows stay unconstrained
  await client.query(`
    CREATE UNIQUE INDEX actions_site_source_operation_version_uidx
      ON actions (site_id, source_id, operation_id, spec_version)
      WHERE source_id IS NOT NULL
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP INDEX IF EXISTS actions_site_source_operation_version_uidx`);
  await client.query(`
    ALTER TABLE actions
      DROP COLUMN IF EXISTS source_id,
      DROP COLUMN IF EXISTS source_type
  `);
  await client.query(`
    ALTER TABLE actions
      ADD CONSTRAINT actions_site_id_operation_id_spec_version_key
      UNIQUE (site_id, operation_id, spec_version)
  `);
  await client.query(`DROP TABLE IF EXISTS site_openapi_sources`);
  await client.query(`DROP TABLE IF EXISTS openapi_source_types`);
}
