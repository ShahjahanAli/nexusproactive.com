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

export async function listProductSignals(
  tenantId: string,
  opts: {
    q?: string;
    siteId?: string;
    status?: string;
    minOccurrences?: number;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ signals: ProductSignalRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;
  const filters: unknown[] = [tenantId];
  const conds: string[] = ['s.tenant_id = $1'];

  if (opts.siteId) {
    filters.push(opts.siteId);
    conds.push(`ps.site_id = $${filters.length}`);
  }
  if (opts.status) {
    filters.push(opts.status);
    conds.push(`ps.status = $${filters.length}`);
  }
  if (opts.q) {
    filters.push(`%${opts.q}%`);
    conds.push(`ps.representative_message ILIKE $${filters.length}`);
  }
  if (opts.minOccurrences && opts.minOccurrences > 1) {
    filters.push(opts.minOccurrences);
    conds.push(`ps.occurrence_count >= $${filters.length}`);
  }

  const where = conds.join(' AND ');

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM product_signals ps
     JOIN sites s ON s.id = ps.site_id
     WHERE ${where}`,
    filters,
  );

  const signals = await query<ProductSignalRow>(
    `SELECT ps.*, s.name AS site_name
     FROM product_signals ps
     JOIN sites s ON s.id = ps.site_id
     WHERE ${where}
     ORDER BY ps.occurrence_count DESC, ps.last_seen DESC
     LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
    [...filters, limit, offset],
  );

  return {
    signals,
    total: parseInt(countRow?.count ?? '0', 10),
  };
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
