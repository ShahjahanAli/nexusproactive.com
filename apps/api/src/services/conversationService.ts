import { query, queryOne } from '../db';
import type { AgentName } from '../agents/types';

export interface Conversation {
  id: string;
  site_id: string;
  visitor_id: string;
  status: string;
  active_agent: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string | null;
  agent_name: string | null;
  tool_calls: unknown;
  created_at: string;
}

export async function getOrCreateConversation(
  siteId: string,
  visitorId: string,
  conversationId?: string,
): Promise<Conversation> {
  if (conversationId) {
    const existing = await queryOne<Conversation>(
      'SELECT * FROM conversations WHERE id = $1 AND site_id = $2',
      [conversationId, siteId],
    );
    if (existing) return existing;
  }

  const row = await queryOne<Conversation>(
    `INSERT INTO conversations (site_id, visitor_id, active_agent)
     VALUES ($1, $2, 'router')
     RETURNING *`,
    [siteId, visitorId],
  );
  if (!row) throw new Error('Failed to create conversation');
  return row;
}

export async function setActiveAgent(
  conversationId: string,
  agent: AgentName,
): Promise<void> {
  await queryOne('UPDATE conversations SET active_agent = $1 WHERE id = $2', [
    agent,
    conversationId,
  ]);
}

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system' | 'tool',
  content: string,
  agentName?: string,
  toolCalls?: unknown,
): Promise<Message> {
  const row = await queryOne<Message>(
    `INSERT INTO messages (conversation_id, role, content, agent_name, tool_calls)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [conversationId, role, content, agentName ?? null, toolCalls ? JSON.stringify(toolCalls) : null],
  );
  if (!row) throw new Error('Failed to save message');
  return row;
}

export async function getConversationMessages(
  conversationId: string,
): Promise<Message[]> {
  return query<Message>(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId],
  );
}

export async function getSiteTenantId(siteId: string): Promise<string | null> {
  const row = await queryOne<{ tenant_id: string }>(
    'SELECT tenant_id FROM sites WHERE id = $1',
    [siteId],
  );
  return row?.tenant_id ?? null;
}
