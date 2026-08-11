import { query, queryOne } from '../db';
import type { AgentName } from '../agents/types';

export interface Conversation {
  id: string;
  site_id: string;
  visitor_id: string;
  status: string;
  active_agent: string;
  cx_agent_id?: string | null;
  detected_language?: string | null;
  handoff_brief?: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string | null;
  agent_name: string | null;
  tool_calls: unknown;
  meta?: Record<string, unknown> | null;
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
    if (existing) {
      // After human handoff is resolved back to AI, do not continue that thread —
      // sticky client IDs would otherwise replay a poisoned history into the LLM.
      if (existing.status === 'open' && (await conversationResumedFromHuman(existing.id))) {
        // fall through to create a fresh conversation
      } else {
        return existing;
      }
    }
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

/** True when an agent returned the chat to AI (resume marker system message exists). */
export async function conversationResumedFromHuman(conversationId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM messages
     WHERE conversation_id = $1
       AND role = 'system'
       AND (
         meta->>'kind' = 'ai_resume'
         OR content ILIKE '%back with the AI assistant%'
         OR content ILIKE '%de nouveau avec l%assistant%'
       )
     LIMIT 1`,
    [conversationId],
  );
  return Boolean(row);
}

/**
 * Keep `detected_language` current from visitor text so live chats show a
 * language marker before any handoff happens. Mutates the passed conversation
 * so the current turn already uses the new language.
 */
export async function noteVisitorLanguage(
  conversation: Conversation,
  message: string,
): Promise<string | null> {
  const { detectLanguage } = await import('./languageDetect');
  const guess = detectLanguage([message]);
  if (!guess.confident || guess.language === conversation.detected_language) {
    return conversation.detected_language ?? null;
  }

  await queryOne('UPDATE conversations SET detected_language = $1 WHERE id = $2', [
    guess.language,
    conversation.id,
  ]);
  conversation.detected_language = guess.language;
  return guess.language;
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
  meta?: Record<string, unknown>,
): Promise<Message> {
  const row = await queryOne<Message>(
    `INSERT INTO messages (conversation_id, role, content, agent_name, tool_calls, meta)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      conversationId,
      role,
      content,
      agentName ?? null,
      toolCalls ? JSON.stringify(toolCalls) : null,
      JSON.stringify(meta ?? {}),
    ],
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
