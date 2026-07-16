import {
  OpenApiSourceType,
  OpenApiSourceTypeRouting,
  SiteOpenApiSource,
} from '@nexus/shared-types';
import { query, queryOne } from '../db';
import { AppError } from '../middleware/errorHandler';

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

export async function listOpenApiSourceTypes(opts?: {
  activeOnly?: boolean;
}): Promise<OpenApiSourceType[]> {
  const rows = await query<OpenApiSourceType>(
    `SELECT key, name, description, sort_order, is_active, routing, created_at, updated_at
     FROM openapi_source_types
     ${opts?.activeOnly ? 'WHERE is_active = true' : ''}
     ORDER BY sort_order ASC, name ASC`,
  );
  return rows.map((r) => ({
    ...r,
    routing: (r.routing ?? {}) as OpenApiSourceTypeRouting,
  }));
}

export async function getOpenApiSourceType(
  key: string,
): Promise<OpenApiSourceType | null> {
  const row = await queryOne<OpenApiSourceType>(
    `SELECT key, name, description, sort_order, is_active, routing, created_at, updated_at
     FROM openapi_source_types WHERE key = $1`,
    [key],
  );
  if (!row) return null;
  return { ...row, routing: (row.routing ?? {}) as OpenApiSourceTypeRouting };
}

export async function createOpenApiSourceType(input: {
  key: string;
  name: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
  routing?: OpenApiSourceTypeRouting;
}): Promise<OpenApiSourceType> {
  const key = normalizeKey(input.key);
  if (!key) throw new AppError('Invalid type key', 400, 'VALIDATION');

  const existing = await getOpenApiSourceType(key);
  if (existing) throw new AppError('Source type already exists', 409, 'CONFLICT');

  const row = await queryOne<OpenApiSourceType>(
    `INSERT INTO openapi_source_types (key, name, description, sort_order, is_active, routing)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING key, name, description, sort_order, is_active, routing, created_at, updated_at`,
    [
      key,
      input.name.trim(),
      input.description ?? null,
      input.sort_order ?? 0,
      input.is_active ?? true,
      JSON.stringify(input.routing ?? {}),
    ],
  );
  if (!row) throw new AppError('Failed to create source type', 500, 'INTERNAL');
  return { ...row, routing: (row.routing ?? {}) as OpenApiSourceTypeRouting };
}

export async function updateOpenApiSourceType(
  key: string,
  patch: {
    name?: string;
    description?: string | null;
    sort_order?: number;
    is_active?: boolean;
    routing?: OpenApiSourceTypeRouting;
  },
): Promise<OpenApiSourceType> {
  const sets: string[] = ['updated_at = now()'];
  const params: unknown[] = [];
  let i = 1;

  if (patch.name !== undefined) {
    sets.push(`name = $${i++}`);
    params.push(patch.name.trim());
  }
  if (patch.description !== undefined) {
    sets.push(`description = $${i++}`);
    params.push(patch.description);
  }
  if (patch.sort_order !== undefined) {
    sets.push(`sort_order = $${i++}`);
    params.push(patch.sort_order);
  }
  if (patch.is_active !== undefined) {
    sets.push(`is_active = $${i++}`);
    params.push(patch.is_active);
  }
  if (patch.routing !== undefined) {
    sets.push(`routing = $${i++}`);
    params.push(JSON.stringify(patch.routing));
  }

  if (sets.length === 1) {
    throw new AppError('No updates', 400, 'VALIDATION');
  }

  params.push(key);
  const row = await queryOne<OpenApiSourceType>(
    `UPDATE openapi_source_types SET ${sets.join(', ')} WHERE key = $${i}
     RETURNING key, name, description, sort_order, is_active, routing, created_at, updated_at`,
    params,
  );
  if (!row) throw new AppError('Source type not found', 404, 'NOT_FOUND');
  return { ...row, routing: (row.routing ?? {}) as OpenApiSourceTypeRouting };
}

export async function deleteOpenApiSourceType(key: string): Promise<void> {
  const inUse = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM site_openapi_sources WHERE type_key = $1`,
    [key],
  );
  if (parseInt(inUse?.count ?? '0', 10) > 0) {
    throw new AppError(
      'Cannot delete a source type that is used by site OpenAPI sources. Disable it instead.',
      409,
      'IN_USE',
    );
  }

  const row = await queryOne<{ key: string }>(
    `DELETE FROM openapi_source_types WHERE key = $1 RETURNING key`,
    [key],
  );
  if (!row) throw new AppError('Source type not found', 404, 'NOT_FOUND');
}

export async function listSiteOpenApiSources(
  siteId: string,
): Promise<SiteOpenApiSource[]> {
  return query<SiteOpenApiSource>(
    `SELECT s.id, s.site_id, s.type_key, s.label, s.url, s.backend_base_url,
            s.is_enabled, s.last_ingested_at, s.last_error, s.created_at, s.updated_at,
            t.name AS type_name
     FROM site_openapi_sources s
     LEFT JOIN openapi_source_types t ON t.key = s.type_key
     WHERE s.site_id = $1
     ORDER BY t.sort_order ASC NULLS LAST, s.created_at ASC`,
    [siteId],
  );
}

export async function getSiteOpenApiSource(
  siteId: string,
  sourceId: string,
): Promise<SiteOpenApiSource | null> {
  return queryOne<SiteOpenApiSource>(
    `SELECT s.id, s.site_id, s.type_key, s.label, s.url, s.backend_base_url,
            s.is_enabled, s.last_ingested_at, s.last_error, s.created_at, s.updated_at,
            t.name AS type_name
     FROM site_openapi_sources s
     LEFT JOIN openapi_source_types t ON t.key = s.type_key
     WHERE s.site_id = $1 AND s.id = $2`,
    [siteId, sourceId],
  );
}

export async function createSiteOpenApiSource(input: {
  siteId: string;
  typeKey: string;
  url: string;
  label?: string | null;
  backendBaseUrl?: string | null;
  isEnabled?: boolean;
}): Promise<SiteOpenApiSource> {
  const type = await getOpenApiSourceType(input.typeKey);
  if (!type || !type.is_active) {
    throw new AppError('OpenAPI source type not found or inactive', 400, 'INVALID_TYPE');
  }

  const row = await queryOne<SiteOpenApiSource>(
    `INSERT INTO site_openapi_sources (site_id, type_key, label, url, backend_base_url, is_enabled)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, site_id, type_key, label, url, backend_base_url, is_enabled,
               last_ingested_at, last_error, created_at, updated_at`,
    [
      input.siteId,
      input.typeKey,
      input.label ?? null,
      input.url,
      input.backendBaseUrl ?? null,
      input.isEnabled ?? true,
    ],
  );
  if (!row) throw new AppError('Failed to create OpenAPI source', 500, 'INTERNAL');

  // Keep legacy mirror in sync with first/primary URL for backwards compatibility
  await syncLegacyOpenApiUrl(input.siteId);

  return { ...row, type_name: type.name };
}

export async function updateSiteOpenApiSource(
  siteId: string,
  sourceId: string,
  patch: {
    typeKey?: string;
    url?: string;
    label?: string | null;
    backendBaseUrl?: string | null;
    isEnabled?: boolean;
  },
): Promise<SiteOpenApiSource> {
  if (patch.typeKey) {
    const type = await getOpenApiSourceType(patch.typeKey);
    if (!type || !type.is_active) {
      throw new AppError('OpenAPI source type not found or inactive', 400, 'INVALID_TYPE');
    }
  }

  const sets: string[] = ['updated_at = now()'];
  const params: unknown[] = [];
  let i = 1;

  if (patch.typeKey !== undefined) {
    sets.push(`type_key = $${i++}`);
    params.push(patch.typeKey);
  }
  if (patch.url !== undefined) {
    sets.push(`url = $${i++}`);
    params.push(patch.url);
  }
  if (patch.label !== undefined) {
    sets.push(`label = $${i++}`);
    params.push(patch.label);
  }
  if (patch.backendBaseUrl !== undefined) {
    sets.push(`backend_base_url = $${i++}`);
    params.push(patch.backendBaseUrl);
  }
  if (patch.isEnabled !== undefined) {
    sets.push(`is_enabled = $${i++}`);
    params.push(patch.isEnabled);
  }

  if (sets.length === 1) {
    throw new AppError('No updates', 400, 'VALIDATION');
  }

  params.push(siteId, sourceId);
  const row = await queryOne<SiteOpenApiSource>(
    `UPDATE site_openapi_sources SET ${sets.join(', ')}
     WHERE site_id = $${i++} AND id = $${i}
     RETURNING id, site_id, type_key, label, url, backend_base_url, is_enabled,
               last_ingested_at, last_error, created_at, updated_at`,
    params,
  );
  if (!row) throw new AppError('OpenAPI source not found', 404, 'NOT_FOUND');

  await syncLegacyOpenApiUrl(siteId);

  const type = await getOpenApiSourceType(row.type_key);
  return { ...row, type_name: type?.name ?? null };
}

export async function deleteSiteOpenApiSource(
  siteId: string,
  sourceId: string,
): Promise<void> {
  const row = await queryOne<{ id: string }>(
    `DELETE FROM site_openapi_sources WHERE site_id = $1 AND id = $2 RETURNING id`,
    [siteId, sourceId],
  );
  if (!row) throw new AppError('OpenAPI source not found', 404, 'NOT_FOUND');
  await syncLegacyOpenApiUrl(siteId);
}

export async function markSourceIngestResult(
  sourceId: string,
  result: { ok: true } | { ok: false; error: string },
): Promise<void> {
  if (result.ok) {
    await query(
      `UPDATE site_openapi_sources
       SET last_ingested_at = now(), last_error = NULL, updated_at = now()
       WHERE id = $1`,
      [sourceId],
    );
  } else {
    await query(
      `UPDATE site_openapi_sources
       SET last_error = $2, updated_at = now()
       WHERE id = $1`,
      [sourceId, result.error.slice(0, 2000)],
    );
  }
}

async function syncLegacyOpenApiUrl(siteId: string): Promise<void> {
  const primary = await queryOne<{ url: string }>(
    `SELECT url FROM site_openapi_sources
     WHERE site_id = $1 AND is_enabled = true
     ORDER BY created_at ASC LIMIT 1`,
    [siteId],
  );
  await query(`UPDATE sites SET openapi_spec_url = $1 WHERE id = $2`, [
    primary?.url ?? null,
    siteId,
  ]);
}

export async function listEnabledOpenApiSources(): Promise<
  Array<SiteOpenApiSource & { site_backend_base_url: string }>
> {
  return query<SiteOpenApiSource & { site_backend_base_url: string }>(
    `SELECT s.id, s.site_id, s.type_key, s.label, s.url, s.backend_base_url,
            s.is_enabled, s.last_ingested_at, s.last_error, s.created_at, s.updated_at,
            sites.backend_base_url AS site_backend_base_url
     FROM site_openapi_sources s
     JOIN sites ON sites.id = s.site_id
     WHERE s.is_enabled = true`,
  );
}
