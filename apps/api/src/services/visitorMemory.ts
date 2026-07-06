import { query, queryOne } from '../db';

export interface VisitorMemory {
  id: string;
  site_id: string;
  visitor_id: string;
  fact: string;
  category: string;
  source: string;
  created_at: string;
}

export async function resolveVisitorId(siteId: string, visitorId: string): Promise<string> {
  const alias = await queryOne<{ canonical_visitor_id: string }>(
    `SELECT canonical_visitor_id FROM visitor_identity_aliases
     WHERE site_id = $1 AND alias_visitor_id = $2`,
    [siteId, visitorId],
  );
  return alias?.canonical_visitor_id ?? visitorId;
}

export async function getVisitorMemories(
  siteId: string,
  visitorId: string,
  limit = 20,
): Promise<VisitorMemory[]> {
  const canonical = await resolveVisitorId(siteId, visitorId);
  return query<VisitorMemory>(
    `SELECT * FROM visitor_memories
     WHERE site_id = $1 AND visitor_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [siteId, canonical, limit],
  );
}

export async function addVisitorMemory(
  siteId: string,
  visitorId: string,
  fact: string,
  category = 'general',
  source = 'system',
): Promise<VisitorMemory> {
  const canonical = await resolveVisitorId(siteId, visitorId);
  const row = await queryOne<VisitorMemory>(
    `INSERT INTO visitor_memories (site_id, visitor_id, fact, category, source)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [siteId, canonical, fact.trim(), category, source],
  );
  if (!row) throw new Error('Failed to save memory');
  return row;
}

export async function mergeVisitorIdentity(
  siteId: string,
  fromVisitorId: string,
  toVisitorId: string,
): Promise<{ merged: boolean }> {
  if (!fromVisitorId || !toVisitorId || fromVisitorId === toVisitorId) {
    return { merged: false };
  }

  const canonical = await resolveVisitorId(siteId, toVisitorId);

  await queryOne(
    `INSERT INTO visitor_identity_aliases (site_id, alias_visitor_id, canonical_visitor_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (site_id, alias_visitor_id) DO UPDATE SET canonical_visitor_id = $3`,
    [siteId, fromVisitorId, canonical],
  );

  await query(
    `UPDATE conversations SET visitor_id = $1
     WHERE site_id = $2 AND visitor_id = $3`,
    [canonical, siteId, fromVisitorId],
  );

  await query(
    `UPDATE visitor_memories SET visitor_id = $1
     WHERE site_id = $2 AND visitor_id = $3`,
    [canonical, siteId, fromVisitorId],
  );

  await query(
    `UPDATE visitor_context SET visitor_id = $1
     WHERE site_id = $2 AND visitor_id = $3`,
    [canonical, siteId, fromVisitorId],
  );

  const { mergeVisitorContacts } = await import('./visitorContacts');
  await mergeVisitorContacts(siteId, fromVisitorId, toVisitorId);

  return { merged: true };
}

export function formatMemoriesForPrompt(memories: VisitorMemory[]): string {
  if (memories.length === 0) return '';
  const lines = memories.map((m) => `- ${m.fact}`).join('\n');
  return `## Visitor context (remember across sessions)\n${lines}`;
}
