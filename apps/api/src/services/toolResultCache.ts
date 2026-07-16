import { createHash } from 'crypto';
import { config } from '../config';
import { getRedis, isRedisEnabled } from './redis';
import { truncateToolResult } from './tokenOptimization';

export interface CachedToolResult {
  status: number;
  body: unknown;
  fetchedAt: string;
  operationId: string;
}

interface MemoryEntry {
  value: CachedToolResult;
  expiresAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();

function ttlSeconds(): number {
  return config.toolCacheTtlSeconds;
}

function argsHash(args: Record<string, unknown>): string {
  const normalized = JSON.stringify(args, Object.keys(args).sort());
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

export function buildCacheKey(input: {
  siteId: string;
  visitorId: string;
  conversationId: string;
  operationId: string;
  args: Record<string, unknown>;
}): string {
  return `wm:${input.siteId}:${input.visitorId}:${input.conversationId}:${input.operationId}:${argsHash(input.args)}`;
}

function conversationPrefix(siteId: string, visitorId: string, conversationId: string): string {
  return `wm:${siteId}:${visitorId}:${conversationId}:`;
}

function pruneMemoryStore(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
}

export async function getCachedToolResult(key: string): Promise<CachedToolResult | null> {
  if (isRedisEnabled()) {
    try {
      const client = getRedis();
      if (client.status !== 'ready') await client.connect();
      const raw = await client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as CachedToolResult;
    } catch {
      // fall through to memory
    }
  }

  pruneMemoryStore();
  const entry = memoryStore.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

export async function setCachedToolResult(
  key: string,
  value: Omit<CachedToolResult, 'fetchedAt'> & { fetchedAt?: string },
): Promise<void> {
  const payload: CachedToolResult = {
    ...value,
    body: truncateToolResult(value.body),
    fetchedAt: value.fetchedAt ?? new Date().toISOString(),
  };
  const ttl = ttlSeconds();

  if (isRedisEnabled()) {
    try {
      const client = getRedis();
      if (client.status !== 'ready') await client.connect();
      await client.set(key, JSON.stringify(payload), 'EX', ttl);
      return;
    } catch {
      // fall through to memory
    }
  }

  pruneMemoryStore();
  memoryStore.set(key, { value: payload, expiresAt: Date.now() + ttl * 1000 });
}

export async function invalidateConversationToolCache(
  siteId: string,
  visitorId: string,
  conversationId: string,
): Promise<void> {
  const prefix = conversationPrefix(siteId, visitorId, conversationId);

  if (isRedisEnabled()) {
    try {
      const client = getRedis();
      if (client.status !== 'ready') await client.connect();
      let cursor = '0';
      do {
        const [next, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
        cursor = next;
        if (keys.length) await client.del(...keys);
      } while (cursor !== '0');
    } catch {
      // fall through
    }
  }

  for (const key of [...memoryStore.keys()]) {
    if (key.startsWith(prefix)) memoryStore.delete(key);
  }
}
