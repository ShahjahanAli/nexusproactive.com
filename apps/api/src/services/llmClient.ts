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
}

interface OpenAiStreamChunk {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
  usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
}

function chatCompletionsUrl(): string {
  return `${config.llm.baseUrl}/chat/completions`;
}

export async function* streamChat(
  options: StreamChatOptions,
): AsyncGenerator<string, void, unknown> {
  const model = options.model ?? config.llm.defaultModel;
  const url = chatCompletionsUrl();

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
    signal: options.signal,
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

export async function completeChat(
  options: Omit<StreamChatOptions, 'signal'>,
): Promise<{ text: string; tokens_used: number }> {
  let result = '';
  let tokens = 0;
  for await (const chunk of streamChat({
    ...options,
    onUsage: (u) => {
      tokens = u.total_tokens;
      options.onUsage?.(u);
    },
  })) {
    result += chunk;
  }
  return { text: result, tokens_used: tokens };
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
  toolChoice?: 'auto' | 'required' | 'none';
  signal?: AbortSignal;
}): Promise<ChatCompletionResult> {
  const model = options.model ?? config.llm.defaultModel;
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
  };
  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? 'auto';
  }

  const response = await fetch(chatCompletionsUrl(), {
    method: 'POST',
    headers: llmHeaders(),
    body: JSON.stringify(body),
    signal: options.signal,
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
        tool_calls?: ToolCall[];
      };
      finish_reason?: string | null;
    }>;
  };

  const choice = data.choices?.[0];
  return {
    content: choice?.message?.content ?? null,
    tool_calls: choice?.message?.tool_calls ?? null,
    finish_reason: choice?.finish_reason ?? null,
    tokens_used: data.usage?.total_tokens ?? 0,
  };
}
