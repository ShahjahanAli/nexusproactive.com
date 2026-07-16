export function parsePageLimit(query: Record<string, unknown>, defaultLimit = 20) {
  const limit = Math.min(Math.max(parseInt(String(query.limit ?? ''), 10) || defaultLimit, 1), 100);
  const page = Math.max(parseInt(String(query.page ?? ''), 10) || 1, 1);
  const offset = (page - 1) * limit;
  return { limit, page, offset };
}

export function parseOptionalString(value: unknown): string | undefined {
  const s = typeof value === 'string' ? value.trim() : '';
  return s || undefined;
}
