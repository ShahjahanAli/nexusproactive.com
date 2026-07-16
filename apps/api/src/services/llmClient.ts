import { config } from '../config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatCompletionResult {
  content: string | null;
  tool_calls: ToolCall[] | null;
  finish_reason: string | null;
  tokens_used: number;
}

export interface LlmUsage {
  total_tokens: number;
}

export interface StreamChatOptions {
  /** Model id understood by your OpenAI-compatible provider. Defaults to LLM_DEFAULT_MODEL. */
  model?: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onUsage?: (usage: LlmUsage) => void;
  /** Override default stream timeout (ms). */
  timeoutMs?: number;
}

interface OpenAiStreamChunk {
  choices?: Array<{
    delta?: { content?: string; reasoning?: string; reasoning_content?: string };
    finish_reason?: string | null;
  }>;
  usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
}

const DEFAULT_LLM_TIMEOUT_MS = Math.max(
  10_000,
  parseInt(process.env.LLM_TIMEOUT_MS ?? '90000', 10) || 90_000,
);
const STREAM_LLM_TIMEOUT_MS = Math.max(
  8_000,
  parseInt(process.env.LLM_STREAM_TIMEOUT_MS ?? '30000', 10) || 30_000,
);

function chatCompletionsUrl(): string {
  return `${config.llm.baseUrl}/chat/completions`;
}

function mergeAbortSignals(
  ...signals: Array<AbortSignal | undefined>
): AbortSignal | undefined {
  const active = signals.filter((s): s is AbortSignal => Boolean(s));
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(active);
  }
  const controller = new AbortController();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  return mergeAbortSignals(signal, AbortSignal.timeout(ms)) ?? AbortSignal.timeout(ms);
}

function formatFetchError(err: unknown, label: string): Error {
  if (!(err instanceof Error)) return new Error(`${label} failed`);
  const name = err.name;
  if (name === 'TimeoutError' || name === 'AbortError' || /aborted|timeout/i.test(err.message)) {
    return new Error(`${label} timed out. Please try again.`);
  }
  if (err.message !== 'fetch failed' && !err.message.includes('ECONNREFUSED')) {
    return err;
  }
  const cause = 'cause' in err ? (err as Error & { cause?: unknown }).cause : undefined;
  const code =
    cause && typeof cause === 'object' && cause !== null && 'code' in cause
      ? String((cause as { code: string }).code)
      : cause instanceof Error
        ? cause.message
        : 'network error';
  return new Error(
    `${label} unreachable (${code}). Check ${label === 'LLM API' ? 'LLM_BASE_URL / API key' : 'connectivity'}.`,
  );
}

function extractMessageText(message: {
  content?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
} | null | undefined): string | null {
  if (!message) return null;
  if (typeof message.content === 'string' && message.content.trim()) return message.content;
  // Do NOT fall back to reasoning for visitor-facing text — reasoning models often
  // fill `reasoning` while leaving `content` null during streaming; using it would
  // dump chain-of-thought into the chat. Tool-calling turns use tool_calls instead.
  return null;
}

export async function* streamChat(
  options: StreamChatOptions,
): AsyncGenerator<string, void, unknown> {
  const model = options.model ?? config.llm.defaultModel;
  const url = chatCompletionsUrl();
  const signal = withTimeout(options.signal, options.timeoutMs ?? STREAM_LLM_TIMEOUT_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.llm.apiKey) {
    headers.Authorization = `Bearer ${config.llm.apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: options.messages,
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal,
  }).catch((err) => {
    throw formatFetchError(err, 'LLM API');
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API error ${response.status}: ${text}`);
  }

  if (!response.body) {
    throw new Error('No response body from LLM API');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data) as OpenAiStreamChunk;
        const content = parsed.choices?.[0]?.delta?.content;
        // Do not stream reasoning/thinking tokens to visitors
        if (content) yield content;
        if (parsed.usage?.total_tokens) {
          options.onUsage?.({ total_tokens: parsed.usage.total_tokens });
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
}

/**
 * Non-streaming completion — preferred for routers/classifiers.
 * Reasoning-only models often leave `content` null; we fall back to `reasoning`.
 */
export async function completeChat(
  options: Omit<StreamChatOptions, 'signal'> & { signal?: AbortSignal },
): Promise<{ text: string; tokens_used: number }> {
  const result = await chatCompletion({
    model: options.model,
    messages: options.messages,
    toolChoice: 'none',
    signal: options.signal,
  });
  options.onUsage?.({ total_tokens: result.tokens_used });
  return { text: result.content ?? '', tokens_used: result.tokens_used };
}

function llmHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.llm.apiKey) headers.Authorization = `Bearer ${config.llm.apiKey}`;
  return headers;
}

export async function chatCompletion(options: {
  model?: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  toolChoice?:
    | 'auto'
    | 'required'
    | 'none'
    | { type: 'function'; function: { name: string } };
  signal?: AbortSignal;
}): Promise<ChatCompletionResult> {
  const requestedModel = options.model ?? config.llm.defaultModel;
  const modelsToTry = [requestedModel];
  if (config.llm.defaultModel && config.llm.defaultModel !== requestedModel) {
    modelsToTry.push(config.llm.defaultModel);
  }

  let lastError: Error | null = null;
  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await chatCompletionOnce({ ...options, model });
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message;
        const invalidModel =
          /not a valid model|invalid model|model_not_found|does not exist/i.test(msg) ||
          msg.includes('LLM API error 400');
        if (invalidModel && model !== config.llm.defaultModel) {
          console.warn(`[llm] model ${model} failed, retrying with ${config.llm.defaultModel}`);
          break; // try next model
        }
        const retryable = /timed?\s*out|timeout|aborted|429|502|503/i.test(msg);
        if (retryable && attempt < 2) {
          console.warn(`[llm] ${model} attempt ${attempt} failed (${msg}); retrying…`);
          continue;
        }
        throw lastError;
      }
    }
  }
  throw lastError ?? new Error('LLM request failed');
}

async function chatCompletionOnce(options: {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  toolChoice?:
    | 'auto'
    | 'required'
    | 'none'
    | { type: 'function'; function: { name: string } };
  signal?: AbortSignal;
}): Promise<ChatCompletionResult> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
  };
  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? 'auto';
  } else if (options.toolChoice === 'none') {
    body.tool_choice = 'none';
  }

  try {
    const response = await fetch(chatCompletionsUrl(), {
      method: 'POST',
      headers: llmHeaders(),
      body: JSON.stringify(body),
      signal: withTimeout(options.signal, DEFAULT_LLM_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      usage?: { total_tokens?: number };
      choices?: Array<{
        message?: {
          content?: string | null;
          reasoning?: string | null;
          reasoning_content?: string | null;
          tool_calls?: ToolCall[];
        };
        finish_reason?: string | null;
      }>;
    };

    const choice = data.choices?.[0];
    return {
      content: extractMessageText(choice?.message),
      tool_calls: choice?.message?.tool_calls ?? null,
      finish_reason: choice?.finish_reason ?? null,
      tokens_used: data.usage?.total_tokens ?? 0,
    };
  } catch (err) {
    throw formatFetchError(err, 'LLM API');
  }
}
