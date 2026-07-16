import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value === 'true' || value === '1';
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export const config = {
  port: parseInt(process.env.PORT ?? '5000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/nexus_widget'),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  /** Off by default in development; set REDIS_ENABLED=true to force on, or false to force off. */
  redisEnabled: parseBool(
    process.env.REDIS_ENABLED,
    process.env.NODE_ENV === 'production',
  ),
  jwtSecret: required('JWT_SECRET', 'dev-secret-change-in-production-min-32-chars!!'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:6100',
  /** Comma-separated list of allowed browser origins (dashboard + admin). */
  corsOrigins: (
    process.env.CORS_ORIGINS ??
    [
      process.env.CORS_ORIGIN ?? 'http://localhost:6100',
      process.env.ADMIN_URL ?? 'http://localhost:6200',
    ].join(',')
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  stripePrices: {
    starter: process.env.STRIPE_PRICE_STARTER ?? '',
    growth: process.env.STRIPE_PRICE_GROWTH ?? '',
    scale: process.env.STRIPE_PRICE_SCALE ?? '',
  },
  /** Any OpenAI-compatible chat completions API (OpenAI, LiteLLM, Ollama, vLLM, etc.). */
  llm: {
    baseUrl: normalizeBaseUrl(
      process.env.LLM_BASE_URL ??
        process.env.LITELLM_BASE_URL ??
        'https://api.openai.com/v1',
    ),
    apiKey: process.env.LLM_API_KEY ?? process.env.LITELLM_API_KEY ?? '',
    defaultModel: process.env.LLM_DEFAULT_MODEL ?? 'gpt-4o-mini',
    fallbackModel: (() => {
      const fallback = process.env.LLM_FALLBACK_MODEL?.trim();
      const primary = process.env.LLM_DEFAULT_MODEL ?? 'gpt-4o-mini';
      // Ignore placeholder / clearly invalid fallback ids
      if (!fallback || /fallback|changeme|example/i.test(fallback)) return primary;
      return fallback;
    })(),
  },
  dashboardUrl: process.env.DASHBOARD_URL ?? 'http://localhost:6100',
  adminUrl: process.env.ADMIN_URL ?? 'http://localhost:6200',
  /** Public base URL for widget script + API (used in embed snippets). */
  publicApiUrl: (
    process.env.PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    `http://localhost:${process.env.PORT ?? '5000'}`
  ).replace(/\/+$/, ''),
  /** Session working-memory TTL for read-only tool results (seconds). */
  toolCacheTtlSeconds: Math.max(
    30,
    parseInt(process.env.TOOL_CACHE_TTL_SECONDS ?? '300', 10) || 300,
  ),
};
