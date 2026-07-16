import { query, queryOne } from '../db';
import { listSiteOpenApiSources } from './openapiSources';

export interface ActionHealthEvent {
  id: string;
  site_id: string;
  action_id: string | null;
  operation_id: string;
  event_type: string;
  severity: string;
  suggestion: string | null;
  meta: Record<string, unknown>;
  resolved_at: string | null;
  created_at: string;
}

export async function scanSiteActionHealth(siteId: string): Promise<number> {
  const failing = await query<{
    action_id: string;
    operation_id: string;
    failures: string;
    total: string;
    last_status: number | null;
  }>(
    `SELECT a.id AS action_id, a.operation_id,
            COUNT(*) FILTER (WHERE ae.status = 'failed' OR COALESCE(ae.http_status, 0) >= 400)::text AS failures,
            COUNT(*)::text AS total,
            MAX(ae.http_status) AS last_status
     FROM action_executions ae
     JOIN actions a ON a.id = ae.action_id
     JOIN conversations c ON c.id = ae.conversation_id
     WHERE c.site_id = $1
       AND ae.created_at > now() - interval '24 hours'
     GROUP BY a.id, a.operation_id
     HAVING COUNT(*) FILTER (WHERE ae.status = 'failed' OR COALESCE(ae.http_status, 0) >= 400) >= 3
        AND (COUNT(*) FILTER (WHERE ae.status = 'failed' OR COALESCE(ae.http_status, 0) >= 400)::float
             / NULLIF(COUNT(*), 0)) >= 0.5`,
    [siteId],
  );

  let created = 0;
  for (const row of failing) {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM action_health_events
       WHERE site_id = $1 AND operation_id = $2 AND resolved_at IS NULL
         AND created_at > now() - interval '24 hours'
       LIMIT 1`,
      [siteId, row.operation_id],
    );
    if (existing) continue;

    const sources = await listSiteOpenApiSources(siteId);
    const suggestion =
      Number(row.last_status) === 404
        ? 'Endpoint may have moved — re-ingest the OpenAPI source or disable this action.'
        : Number(row.last_status) === 422
          ? 'Request schema may have drifted — re-ingest OpenAPI and review input parameters.'
          : 'High failure rate detected — review backend health or disable the action temporarily.';

    await queryOne(
      `INSERT INTO action_health_events
         (site_id, action_id, operation_id, event_type, severity, suggestion, meta)
       VALUES ($1, $2, $3, 'high_error_rate', $4, $5, $6)`,
      [
        siteId,
        row.action_id,
        row.operation_id,
        Number(row.failures) >= 10 ? 'critical' : 'warning',
        suggestion,
        JSON.stringify({
          failures: Number(row.failures),
          total: Number(row.total),
          lastStatus: row.last_status,
          openApiSources: sources.map((s) => ({ id: s.id, type: s.type_key, url: s.url })),
        }),
      ],
    );
    created += 1;
  }
  return created;
}

export async function scanAllSitesActionHealth(): Promise<number> {
  const sites = await query<{ id: string }>('SELECT id FROM sites');
  let total = 0;
  for (const site of sites) {
    total += await scanSiteActionHealth(site.id);
  }
  return total;
}

export async function listActionHealthEvents(
  siteId: string,
  includeResolved = false,
): Promise<ActionHealthEvent[]> {
  return query<ActionHealthEvent>(
    `SELECT * FROM action_health_events
     WHERE site_id = $1
       ${includeResolved ? '' : 'AND resolved_at IS NULL'}
     ORDER BY created_at DESC
     LIMIT 50`,
    [siteId],
  );
}

export async function resolveActionHealthEvent(
  siteId: string,
  eventId: string,
): Promise<boolean> {
  const row = await queryOne(
    `UPDATE action_health_events
     SET resolved_at = now()
     WHERE id = $1 AND site_id = $2
     RETURNING id`,
    [eventId, siteId],
  );
  return Boolean(row);
}

export async function listTenantActionHealth(tenantId: string): Promise<
  Array<ActionHealthEvent & { site_name: string }>
> {
  return query(
    `SELECT e.*, s.name AS site_name
     FROM action_health_events e
     JOIN sites s ON s.id = e.site_id
     WHERE s.tenant_id = $1 AND e.resolved_at IS NULL
     ORDER BY e.created_at DESC
     LIMIT 50`,
    [tenantId],
  );
}
