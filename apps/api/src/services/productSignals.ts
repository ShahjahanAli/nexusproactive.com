import { query, queryOne } from '../db';

export interface ProductSignalRow {
  id: string;
  site_id: string;
  cluster_label: string | null;
  representative_message: string;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  status: string;
  site_name: string;
  suggested_endpoint?: Record<string, unknown> | null;
  suggestion_status?: string | null;
}

export interface ProductSignalStats {
  total: number;
  new_count: number;
  reviewed: number;
  resolved: number;
  hot: number;
  occurrences: number;
  with_suggestion: number;
  sites: number;
  last_7_days: number;
}

interface SignalFilters {
  q?: string;
  siteId?: string;
  status?: string;
  minOccurrences?: number;
}

function buildWhere(tenantId: string, opts: SignalFilters) {
  const params: unknown[] = [tenantId];
  const conds: string[] = ['s.tenant_id = $1'];

  if (opts.siteId) {
    params.push(opts.siteId);
    conds.push(`ps.site_id = $${params.length}`);
  }
  if (opts.status) {
    params.push(opts.status);
    conds.push(`ps.status = $${params.length}`);
  }
  if (opts.q) {
    params.push(`%${opts.q}%`);
    conds.push(`ps.representative_message ILIKE $${params.length}`);
  }
  if (opts.minOccurrences && opts.minOccurrences > 1) {
    params.push(opts.minOccurrences);
    conds.push(`ps.occurrence_count >= $${params.length}`);
  }

  return { where: conds.join(' AND '), params };
}

export async function listProductSignals(
  tenantId: string,
  opts: SignalFilters & { limit?: number; offset?: number } = {},
): Promise<{ signals: ProductSignalRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;
  const { where, params } = buildWhere(tenantId, opts);

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM product_signals ps
     JOIN sites s ON s.id = ps.site_id
     WHERE ${where}`,
    params,
  );

  const signals = await query<ProductSignalRow>(
    `SELECT ps.*, s.name AS site_name
     FROM product_signals ps
     JOIN sites s ON s.id = ps.site_id
     WHERE ${where}
     ORDER BY ps.occurrence_count DESC, ps.last_seen DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return {
    signals,
    total: parseInt(countRow?.count ?? '0', 10),
  };
}

export async function getProductSignalStats(
  tenantId: string,
  opts: SignalFilters = {},
): Promise<ProductSignalStats> {
  const { where, params } = buildWhere(tenantId, opts);

  const row = await queryOne<{
    total: string;
    new_count: string;
    reviewed: string;
    resolved: string;
    hot: string;
    occurrences: string;
    with_suggestion: string;
    sites: string;
    last_7_days: string;
  }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE ps.status = 'new')::text AS new_count,
       COUNT(*) FILTER (WHERE ps.status = 'reviewed')::text AS reviewed,
       COUNT(*) FILTER (WHERE ps.status = 'resolved')::text AS resolved,
       COUNT(*) FILTER (WHERE ps.occurrence_count >= 5 AND ps.status = 'new')::text AS hot,
       COALESCE(SUM(ps.occurrence_count), 0)::text AS occurrences,
       COUNT(*) FILTER (
         WHERE ps.suggestion_status IN ('ready', 'reviewed')
            OR ps.suggested_endpoint IS NOT NULL
       )::text AS with_suggestion,
       COUNT(DISTINCT ps.site_id)::text AS sites,
       COUNT(*) FILTER (WHERE ps.last_seen >= now() - interval '7 days')::text AS last_7_days
     FROM product_signals ps
     JOIN sites s ON s.id = ps.site_id
     WHERE ${where}`,
    params,
  );

  return {
    total: parseInt(row?.total ?? '0', 10),
    new_count: parseInt(row?.new_count ?? '0', 10),
    reviewed: parseInt(row?.reviewed ?? '0', 10),
    resolved: parseInt(row?.resolved ?? '0', 10),
    hot: parseInt(row?.hot ?? '0', 10),
    occurrences: parseInt(row?.occurrences ?? '0', 10),
    with_suggestion: parseInt(row?.with_suggestion ?? '0', 10),
    sites: parseInt(row?.sites ?? '0', 10),
    last_7_days: parseInt(row?.last_7_days ?? '0', 10),
  };
}

export async function updateProductSignalStatus(
  tenantId: string,
  signalId: string,
  status: 'new' | 'reviewed' | 'resolved',
): Promise<boolean> {
  const row = await queryOne(
    `UPDATE product_signals ps
     SET status = $3
     FROM sites s
     WHERE ps.site_id = s.id AND ps.id = $1 AND s.tenant_id = $2
     RETURNING ps.id`,
    [signalId, tenantId, status],
  );
  return Boolean(row);
}

export async function recordProductSignal(
  siteId: string,
  message: string,
): Promise<void> {
  const normalized = message.trim().toLowerCase().slice(0, 500);
  if (!normalized) return;

  const existing = await queryOne<{ id: string; occurrence_count: number }>(
    `SELECT id, occurrence_count FROM product_signals
     WHERE site_id = $1 AND LOWER(representative_message) = $2`,
    [siteId, normalized],
  );

  if (existing) {
    await queryOne(
      `UPDATE product_signals SET occurrence_count = $1, last_seen = now() WHERE id = $2`,
      [existing.occurrence_count + 1, existing.id],
    );
    return;
  }

  await queryOne(
    `INSERT INTO product_signals (site_id, cluster_label, representative_message, occurrence_count)
     VALUES ($1, $2, $3, 1)`,
    [siteId, 'unresolved_intent', message.slice(0, 500)],
  );
}

export async function clusterProductSignals(siteId: string): Promise<number> {
  // Simple nightly pass: group by first 40 chars as pseudo-cluster label
  const { query } = await import('../db');
  const signals = await query<{ id: string; representative_message: string }>(
    `SELECT id, representative_message FROM product_signals WHERE site_id = $1 AND status = 'new'`,
    [siteId],
  );

  const clusters = new Map<string, string[]>();
  for (const s of signals) {
    const key = s.representative_message.slice(0, 40).toLowerCase();
    const list = clusters.get(key) ?? [];
    list.push(s.id);
    clusters.set(key, list);
  }

  for (const [label, ids] of clusters) {
    if (ids.length > 1) {
      await queryOne(
        `UPDATE product_signals SET cluster_label = $1, occurrence_count = occurrence_count + $2 WHERE id = ANY($3)`,
        [label, 0, ids],
      );
    }
  }

  return signals.length;
}

export async function generateSignalApiSuggestion(
  tenantId: string,
  signalId: string,
): Promise<{ signal: ProductSignalRow; suggestion: Record<string, unknown> } | null> {
  const signal = await queryOne<ProductSignalRow>(
    `SELECT ps.*, s.name AS site_name
     FROM product_signals ps
     JOIN sites s ON s.id = ps.site_id
     WHERE ps.id = $1 AND s.tenant_id = $2`,
    [signalId, tenantId],
  );
  if (!signal) return null;

  const { completeChat } = await import('./llmClient');
  const { config } = await import('../config');
  const { text } = await completeChat({
    model: config.llm.fallbackModel,
    messages: [
      {
        role: 'system',
        content: `Design a minimal OpenAPI 3 path item for a missing business capability.
Reply JSON only:
{"path":"/example","method":"get","operationId":"...","summary":"...","requestBody":null,"parameters":[],"responses":{"200":{"description":"...","schema":{}}}}`,
      },
      {
        role: 'user',
        content: `Customer requests clustered as "${signal.cluster_label ?? 'unresolved'}":
Representative: ${signal.representative_message}
Occurrences: ${signal.occurrence_count}`,
      },
    ],
  });

  let suggestion: Record<string, unknown>;
  try {
    suggestion = JSON.parse(text.replace(/```json|```/g, '').trim()) as Record<string, unknown>;
  } catch {
    suggestion = {
      path: '/custom/unresolved-intent',
      method: 'get',
      operationId: 'getUnresolvedIntent',
      summary: signal.representative_message.slice(0, 120),
      raw: text,
    };
  }

  const updated = await queryOne<ProductSignalRow>(
    `UPDATE product_signals
     SET suggested_endpoint = $1, suggestion_status = 'ready'
     WHERE id = $2
     RETURNING *`,
    [JSON.stringify(suggestion), signalId],
  );

  const tenantIdForHook = await queryOne<{ tenant_id: string }>(
    'SELECT tenant_id FROM sites WHERE id = $1',
    [signal.site_id],
  );
  if (tenantIdForHook?.tenant_id) {
    const { dispatchWebhook } = await import('./webhooks');
    void dispatchWebhook(tenantIdForHook.tenant_id, 'signal.suggestion_ready', {
      signalId,
      suggestion,
    });
  }

  return {
    signal: { ...signal, ...updated, suggested_endpoint: suggestion, suggestion_status: 'ready' },
    suggestion,
  };
}

export async function markSignalSuggestionReviewed(
  tenantId: string,
  signalId: string,
): Promise<boolean> {
  const row = await queryOne(
    `UPDATE product_signals ps
     SET suggestion_status = 'reviewed', status = 'reviewed'
     FROM sites s
     WHERE ps.site_id = s.id AND ps.id = $1 AND s.tenant_id = $2
     RETURNING ps.id`,
    [signalId, tenantId],
  );
  return Boolean(row);
}
