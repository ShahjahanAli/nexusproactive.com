import { queryOne } from '../db';

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
