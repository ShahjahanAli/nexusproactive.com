export type ListSearchParams = Record<string, string | undefined>;

export function buildListQuery(params: ListSearchParams, keys: string[]) {
  const qs = new URLSearchParams();
  for (const key of keys) {
    const value = params[key]?.trim();
    if (value) qs.set(key, value);
  }
  return qs;
}

export function currentPage(params: ListSearchParams) {
  const page = parseInt(params.page ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function pageCount(total: number, limit: number) {
  return Math.max(1, Math.ceil(total / limit));
}
