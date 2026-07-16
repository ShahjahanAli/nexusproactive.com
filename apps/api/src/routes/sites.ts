import { Router } from 'express';
import { z } from 'zod';
import { Site } from '@nexus/shared-types';
import { requireTenantAuth } from '../middleware/auth';
import { withTenant, query, queryOne } from '../db';
import { checkPlanLimit } from '../services/planLimits';
import { generateJwtSigningSecret } from '../services/authService';
import { ingestOpenApiSource, ingestOpenApiSpec } from '../services/actionGraph';
import {
  createSiteOpenApiSource,
  deleteSiteOpenApiSource,
  listOpenApiSourceTypes,
  listSiteOpenApiSources,
  updateSiteOpenApiSource,
} from '../services/openapiSources';
import { AppError } from '../middleware/errorHandler';

const router = Router();

router.get('/openapi-source-types', requireTenantAuth, async (_req, res) => {
  const types = await listOpenApiSourceTypes({ activeOnly: true });
  res.json({ types });
});

router.get('/', requireTenantAuth, async (req, res) => {
  const sites = await withTenant(req.tenantId!, async (client) => {
    const result = await client.query<Site>(
      `SELECT id, tenant_id, name, domain, backend_base_url, openapi_spec_url,
              widget_theme, created_at
       FROM sites WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [req.tenantId],
    );
    return result.rows;
  });
  res.json({ sites });
});

const createSiteSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  backendBaseUrl: z.string().url(),
  openapiSpecUrl: z.string().url().optional(),
  openapiSources: z
    .array(
      z.object({
        typeKey: z.string().min(1),
        url: z.string().url(),
        label: z.string().nullable().optional(),
        backendBaseUrl: z.string().url().nullable().optional(),
      }),
    )
    .optional(),
});

router.post('/', requireTenantAuth, async (req, res) => {
  const limit = await checkPlanLimit(req.tenantId!, 'max_sites');
  if (!limit.allowed) {
    res.status(403).json({ error: limit.message, code: 'PLAN_LIMIT', ...limit });
    return;
  }

  const body = createSiteSchema.parse(req.body);
  const jwtSecret = generateJwtSigningSecret();

  const site = await withTenant(req.tenantId!, async (client) => {
    const result = await client.query<Site>(
      `INSERT INTO sites (tenant_id, name, domain, backend_base_url, openapi_spec_url, jwt_signing_secret)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tenant_id, name, domain, backend_base_url, openapi_spec_url, widget_theme, created_at`,
      [
        req.tenantId,
        body.name,
        body.domain,
        body.backendBaseUrl,
        body.openapiSpecUrl ?? null,
        jwtSecret,
      ],
    );
    return result.rows[0];
  });

  const ingestResults = [];
  if (body.openapiSources?.length) {
    for (const src of body.openapiSources) {
      const created = await createSiteOpenApiSource({
        siteId: site.id,
        typeKey: src.typeKey,
        url: src.url,
        label: src.label,
        backendBaseUrl: src.backendBaseUrl,
      });
      ingestResults.push(await ingestOpenApiSource(created.id));
    }
  } else if (body.openapiSpecUrl) {
    ingestResults.push(await ingestOpenApiSpec(site.id, body.openapiSpecUrl));
  }

  res.status(201).json({ site, ingest: ingestResults[0] ?? null, ingests: ingestResults });
});

router.get('/:siteId', requireTenantAuth, async (req, res) => {
  const site = await queryOne<Site>(
    `SELECT id, tenant_id, name, domain, backend_base_url, openapi_spec_url,
            widget_theme, created_at
     FROM sites WHERE id = $1 AND tenant_id = $2`,
    [req.params.siteId, req.tenantId],
  );
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  res.json({ site });
});

const updateSiteSchema = z.object({
  name: z.string().min(1).optional(),
  domain: z.string().min(1).optional(),
  backendBaseUrl: z.string().url().optional(),
  openapiSpecUrl: z.string().url().nullable().optional(),
  widgetTheme: z.record(z.unknown()).optional(),
  reingest: z.boolean().optional(),
});

router.patch('/:siteId', requireTenantAuth, async (req, res) => {
  const body = updateSiteSchema.parse(req.body);

  const existing = await queryOne<Site>(
    `SELECT id, openapi_spec_url FROM sites WHERE id = $1 AND tenant_id = $2`,
    [req.params.siteId, req.tenantId],
  );
  if (!existing) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (body.name !== undefined) {
    sets.push(`name = $${i++}`);
    params.push(body.name);
  }
  if (body.domain !== undefined) {
    sets.push(`domain = $${i++}`);
    params.push(body.domain);
  }
  if (body.backendBaseUrl !== undefined) {
    sets.push(`backend_base_url = $${i++}`);
    params.push(body.backendBaseUrl);
  }
  if (body.openapiSpecUrl !== undefined) {
    sets.push(`openapi_spec_url = $${i++}`);
    params.push(body.openapiSpecUrl);
  }
  if (body.widgetTheme !== undefined) {
    sets.push(`widget_theme = COALESCE(widget_theme, '{}'::jsonb) || $${i++}::jsonb`);
    params.push(JSON.stringify(body.widgetTheme));
  }

  if (sets.length === 0 && !body.reingest) {
    res.status(400).json({ error: 'No updates' });
    return;
  }

  let site = existing;
  if (sets.length > 0) {
    params.push(req.params.siteId, req.tenantId);
    const updated = await queryOne<Site>(
      `UPDATE sites SET ${sets.join(', ')}
       WHERE id = $${i++} AND tenant_id = $${i}
       RETURNING id, tenant_id, name, domain, backend_base_url, openapi_spec_url, widget_theme, created_at`,
      params,
    );
    if (!updated) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }
    site = updated;
  } else {
    const full = await queryOne<Site>(
      `SELECT id, tenant_id, name, domain, backend_base_url, openapi_spec_url, widget_theme, created_at
       FROM sites WHERE id = $1 AND tenant_id = $2`,
      [req.params.siteId, req.tenantId],
    );
    if (full) site = full;
  }

  const specUrl = body.openapiSpecUrl ?? site.openapi_spec_url;
  const specChanged =
    body.openapiSpecUrl !== undefined && body.openapiSpecUrl !== existing.openapi_spec_url;
  const shouldIngest = specUrl && (specChanged || body.reingest);

  let ingestResult = null;
  if (body.reingest) {
    const sources = await listSiteOpenApiSources(site.id);
    const enabled = sources.filter((s) => s.is_enabled);
    if (enabled.length > 0) {
      const results = [];
      for (const src of enabled) {
        results.push(await ingestOpenApiSource(src.id));
      }
      res.json({ site, ingest: results[0] ?? null, ingests: results });
      return;
    }
  }

  if (shouldIngest && specUrl) {
    ingestResult = await ingestOpenApiSpec(site.id, specUrl);
  }

  res.json({ site, ingest: ingestResult });
});

async function assertSiteOwned(siteId: string, tenantId: string) {
  const sites = await query<{ id: string }>(
    'SELECT id FROM sites WHERE id = $1 AND tenant_id = $2',
    [siteId, tenantId],
  );
  if (!sites[0]) {
    throw new AppError('Site not found', 404, 'NOT_FOUND');
  }
}

router.get('/:siteId/openapi-sources', requireTenantAuth, async (req, res) => {
  await assertSiteOwned(req.params.siteId, req.tenantId!);
  const sources = await listSiteOpenApiSources(req.params.siteId);
  res.json({ sources });
});

const createSourceSchema = z.object({
  typeKey: z.string().min(1),
  url: z.string().url(),
  label: z.string().nullable().optional(),
  backendBaseUrl: z.string().url().nullable().optional(),
  isEnabled: z.boolean().optional(),
  ingest: z.boolean().optional(),
});

router.post('/:siteId/openapi-sources', requireTenantAuth, async (req, res) => {
  await assertSiteOwned(req.params.siteId, req.tenantId!);
  const body = createSourceSchema.parse(req.body);
  const source = await createSiteOpenApiSource({
    siteId: req.params.siteId,
    typeKey: body.typeKey,
    url: body.url,
    label: body.label,
    backendBaseUrl: body.backendBaseUrl,
    isEnabled: body.isEnabled,
  });

  let ingest = null;
  if (body.ingest !== false) {
    ingest = await ingestOpenApiSource(source.id);
  }

  res.status(201).json({ source, ingest });
});

const updateSourceSchema = z.object({
  typeKey: z.string().min(1).optional(),
  url: z.string().url().optional(),
  label: z.string().nullable().optional(),
  backendBaseUrl: z.string().url().nullable().optional(),
  isEnabled: z.boolean().optional(),
  reingest: z.boolean().optional(),
});

router.patch('/:siteId/openapi-sources/:sourceId', requireTenantAuth, async (req, res) => {
  await assertSiteOwned(req.params.siteId, req.tenantId!);
  const body = updateSourceSchema.parse(req.body);
  const { reingest, ...patch } = body;
  const source = await updateSiteOpenApiSource(
    req.params.siteId,
    req.params.sourceId,
    patch,
  );

  let ingest = null;
  if (reingest || patch.url !== undefined || patch.typeKey !== undefined) {
    if (source.is_enabled) {
      ingest = await ingestOpenApiSource(source.id);
    }
  }

  res.json({ source, ingest });
});

router.delete('/:siteId/openapi-sources/:sourceId', requireTenantAuth, async (req, res) => {
  await assertSiteOwned(req.params.siteId, req.tenantId!);
  await deleteSiteOpenApiSource(req.params.siteId, req.params.sourceId);
  res.json({ ok: true });
});

router.post(
  '/:siteId/openapi-sources/:sourceId/ingest',
  requireTenantAuth,
  async (req, res) => {
    await assertSiteOwned(req.params.siteId, req.tenantId!);
    const result = await ingestOpenApiSource(req.params.sourceId);
    res.json(result);
  },
);

router.post('/:siteId/ingest', requireTenantAuth, async (req, res) => {
  const specUrlSchema = z.object({
    specUrl: z.string().url(),
    typeKey: z.string().min(1).optional(),
  });
  const { specUrl, typeKey } = specUrlSchema.parse(req.body);

  await assertSiteOwned(req.params.siteId, req.tenantId!);
  const result = await ingestOpenApiSpec(req.params.siteId, specUrl, { typeKey });
  res.json(result);
});

router.get('/:siteId/actions', requireTenantAuth, async (req, res) => {
  await assertSiteOwned(req.params.siteId, req.tenantId!);

  const actions = await query(
    `SELECT id, site_id, operation_id, method, path, description, risk_tier,
            spec_version, is_active, reviewed_by_human, source_id, source_type, created_at
     FROM actions WHERE site_id = $1 ORDER BY source_type NULLS LAST, path, method`,
    [req.params.siteId],
  );
  res.json({ actions });
});

router.patch('/actions/:actionId', requireTenantAuth, async (req, res) => {
  const schema = z.object({
    riskTier: z.enum(['read_only', 'reversible_write', 'irreversible_write', 'financial']).optional(),
    reviewed: z.boolean().optional(),
    isActive: z.boolean().optional(),
  });
  const body = schema.parse(req.body);

  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (body.riskTier) {
    sets.push(`risk_tier = $${i++}`);
    params.push(body.riskTier);
  }
  if (body.reviewed !== undefined) {
    sets.push(`reviewed_by_human = $${i++}`);
    params.push(body.reviewed);
  }
  if (body.isActive !== undefined) {
    sets.push(`is_active = $${i++}`);
    params.push(body.isActive);
  }

  if (sets.length === 0) {
    res.status(400).json({ error: 'No updates' });
    return;
  }

  params.push(req.params.actionId, req.tenantId);
  await query(
    `UPDATE actions SET ${sets.join(', ')}
     FROM sites s
     WHERE actions.site_id = s.id AND actions.id = $${i++} AND s.tenant_id = $${i}`,
    params,
  );
  res.json({ ok: true });
});

router.get('/:siteId/action-health', requireTenantAuth, async (req, res) => {
  const site = await queryOne<{ id: string }>(
    'SELECT id FROM sites WHERE id = $1 AND tenant_id = $2',
    [req.params.siteId, req.tenantId],
  );
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const { listActionHealthEvents } = await import('../services/actionHealth');
  const events = await listActionHealthEvents(req.params.siteId);
  res.json({ events });
});

router.post('/:siteId/action-health/:eventId/resolve', requireTenantAuth, async (req, res) => {
  const { resolveActionHealthEvent } = await import('../services/actionHealth');
  const ok = await resolveActionHealthEvent(req.params.siteId, req.params.eventId);
  if (!ok) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  res.json({ ok: true });
});

export default router;
