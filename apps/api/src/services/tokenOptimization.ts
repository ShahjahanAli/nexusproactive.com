/** Max user+assistant messages sent to the LLM per request (older turns dropped). */
export const MAX_LLM_HISTORY_MESSAGES = 16;

/** Max characters for a single tool/API result in the LLM context. */
export const TOOL_RESULT_MAX_CHARS = 6000;

/** When a site has more actions than this, use compact tool catalog in system prompt. */
export const COMPACT_TOOL_CATALOG_THRESHOLD = 8;

const EVENT_DATE_KEYS = [
  'startDate',
  'start_date',
  'startsAt',
  'starts_at',
  'beginDate',
  'begin_date',
  'eventDate',
  'event_date',
  'date',
  'from',
  'start',
  'dateLabel',
  'date_label',
  'displayDate',
  'when',
  'schedule',
] as const;

const MONTH_DATE_RE =
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s*\d{4})?\b/i;

export function trimHistory<T extends { role: string }>(
  messages: T[],
  maxMessages = MAX_LLM_HISTORY_MESSAGES,
): T[] {
  if (messages.length <= maxMessages) return messages;
  return messages.slice(-maxMessages);
}

/** True when history ends with 2+ user turns without an assistant reply between them. */
export function hasUnansweredPriorUserTurn(
  messages: Array<{ role: string }>,
): boolean {
  let userStreak = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const role = messages[i]?.role;
    if (role === 'user') {
      userStreak++;
      continue;
    }
    if (role === 'assistant') break;
  }
  return userStreak > 1;
}

function parseFlexibleDate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Heuristic: unix seconds vs ms
    const ms = value < 1e12 ? value * 1000 : value;
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return direct;
  const m = value.match(MONTH_DATE_RE);
  if (m) {
    const fromLabel = Date.parse(m[0]);
    if (!Number.isNaN(fromLabel)) return fromLabel;
  }
  return null;
}

function extractSortDate(item: unknown): number {
  if (!item || typeof item !== 'object') return Number.POSITIVE_INFINITY;
  const o = item as Record<string, unknown>;
  for (const key of EVENT_DATE_KEYS) {
    const t = parseFlexibleDate(o[key]);
    if (t != null) return t;
  }
  if (o.dates && typeof o.dates === 'object') {
    const nested = extractSortDate(o.dates);
    if (nested !== Number.POSITIVE_INFINITY) return nested;
  }
  return Number.POSITIVE_INFINITY;
}

function looksLikeEventItem(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const o = item as Record<string, unknown>;
  const hasTitle = typeof o.title === 'string' || typeof o.name === 'string';
  const hasDate = EVENT_DATE_KEYS.some((k) => o[k] != null);
  const hasPlace =
    typeof o.venue === 'string' ||
    typeof o.location === 'string' ||
    typeof o.city === 'string' ||
    typeof o.country === 'string';
  const hasSlug = typeof o.slug === 'string';
  return (hasTitle && (hasDate || hasPlace || hasSlug)) || (hasSlug && hasDate);
}

function looksLikeEventList(arr: unknown[]): boolean {
  const sample = arr.filter((x) => x && typeof x === 'object').slice(0, 5);
  if (sample.length === 0) return false;
  const hits = sample.filter(looksLikeEventItem).length;
  return hits >= Math.ceil(sample.length / 2);
}

/** Sort conference/event-like arrays soonest-first so "next" answers stay correct after truncation. */
export function sortEventListsSoonestFirst(body: unknown): unknown {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      const mapped = node.map(walk);
      if (looksLikeEventList(mapped)) {
        return [...mapped].sort((a, b) => extractSortDate(a) - extractSortDate(b));
      }
      return mapped;
    }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        out[k] = walk(v);
      }
      return out;
    }
    return node;
  };

  const sorted = walk(body);
  if (sorted && typeof sorted === 'object' && !Array.isArray(sorted)) {
    const obj = sorted as Record<string, unknown>;
    const listKey = ['conferences', 'events', 'items', 'results', 'data'].find((k) =>
      Array.isArray(obj[k]),
    );
    if (listKey && looksLikeEventList(obj[listKey] as unknown[])) {
      return {
        ...obj,
        _listHint:
          'Items are sorted soonest-first. For "next" / "upcoming" questions, lead with the first item. Prefer publicUrl (or url) for markdown links.',
      };
    }
  }
  return sorted;
}

export function truncateToolResult(body: unknown, maxChars = TOOL_RESULT_MAX_CHARS): unknown {
  let str = JSON.stringify(body);
  if (str.length <= maxChars) return body;

  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    const copy: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const [key, value] of Object.entries(copy)) {
      if (Array.isArray(value) && value.length > 6) {
        copy[key] = [
          ...value.slice(0, 6),
          { _note: `${value.length - 6} more items omitted — ask user to narrow search or paginate` },
        ];
      }
    }
    str = JSON.stringify(copy);
    if (str.length <= maxChars) return copy;
    return {
      _truncated: true,
      summary: str.slice(0, maxChars),
      note: 'API response truncated. Summarize from summary; do not invent data.',
    };
  }

  if (Array.isArray(body) && body.length > 6) {
    return [
      ...body.slice(0, 6),
      { _note: `${body.length - 6} more items omitted` },
    ];
  }

  return {
    _truncated: true,
    preview: str.slice(0, maxChars),
    note: 'Response truncated for token limits.',
  };
}

/**
 * Rewrite localhost / private API URLs to the public site domain so the LLM
 * emits clickable visitor-facing links (e.g. conference landing pages).
 */
export function publicizeToolPayload(body: unknown, siteDomain: string): unknown {
  if (!siteDomain) return body;
  const host = siteDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const origin = `https://${host}`;

  const rewriteString = (value: string): string => {
    try {
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(value)) {
        const u = new URL(value);
        return `${origin}${u.pathname}${u.search}${u.hash}`;
      }
    } catch {
      /* keep original */
    }
    return value;
  };

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return rewriteString(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = walk(v);
      }
      // Ensure conference-like objects expose a publicUrl hint for the model
      if (typeof out.path === 'string' && out.path.startsWith('/')) {
        out.publicUrl = `${origin}${out.path}`;
      } else if (typeof out.slug === 'string' && out.slug && !out.publicUrl) {
        out.publicUrl = `${origin}/conference/${out.slug}`;
      }
      if (typeof out.url === 'string') {
        out.url = rewriteString(out.url);
      }
      return out;
    }
    return node;
  };

  return walk(body);
}

/** Sort events, rewrite public URLs, then truncate — order matters for "next" queries. */
export function prepareToolResultForLlm(body: unknown, siteDomain: string): unknown {
  return truncateToolResult(
    publicizeToolPayload(sortEventListsSoonestFirst(body), siteDomain),
  );
}
