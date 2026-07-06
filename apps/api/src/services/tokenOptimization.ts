/** Max user+assistant messages sent to the LLM per request (older turns dropped). */
export const MAX_LLM_HISTORY_MESSAGES = 16;

/** Max characters for a single tool/API result in the LLM context. */
export const TOOL_RESULT_MAX_CHARS = 6000;

/** When a site has more actions than this, use compact tool catalog in system prompt. */
export const COMPACT_TOOL_CATALOG_THRESHOLD = 8;

export function trimHistory<T extends { role: string }>(
  messages: T[],
  maxMessages = MAX_LLM_HISTORY_MESSAGES,
): T[] {
  if (messages.length <= maxMessages) return messages;
  return messages.slice(-maxMessages);
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
