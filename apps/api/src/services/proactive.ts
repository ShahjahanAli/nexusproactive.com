import { query, queryOne } from '../db';

export interface ProactiveTrigger {
  id: string;
  site_id: string;
  name: string;
  trigger_type: 'page_view' | 'idle' | 'custom_event';
  conditions: Record<string, unknown>;
  message_template: string;
  is_active: boolean;
  created_at: string;
}

export interface ContextInput {
  siteId: string;
  visitorId: string;
  pageUrl?: string;
  pageTitle?: string;
  idleSeconds?: number;
  event?: string;
  metadata?: Record<string, unknown>;
}

export async function updateVisitorContext(input: ContextInput): Promise<void> {
  await queryOne(
    `INSERT INTO visitor_context (site_id, visitor_id, page_url, page_title, idle_seconds, metadata, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (site_id, visitor_id) DO UPDATE SET
       page_url = COALESCE($3, visitor_context.page_url),
       page_title = COALESCE($4, visitor_context.page_title),
       idle_seconds = COALESCE($5, visitor_context.idle_seconds),
       metadata = visitor_context.metadata || COALESCE($6, '{}'::jsonb),
       updated_at = now()`,
    [
      input.siteId,
      input.visitorId,
      input.pageUrl ?? null,
      input.pageTitle ?? null,
      input.idleSeconds ?? 0,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function listProactiveTriggers(siteId: string): Promise<ProactiveTrigger[]> {
  return query<ProactiveTrigger>(
    `SELECT * FROM proactive_triggers WHERE site_id = $1 ORDER BY created_at DESC`,
    [siteId],
  );
}

export async function createProactiveTrigger(
  siteId: string,
  data: {
    name: string;
    triggerType: ProactiveTrigger['trigger_type'];
    conditions: Record<string, unknown>;
    messageTemplate: string;
  },
): Promise<ProactiveTrigger> {
  const rows = await query<ProactiveTrigger>(
    `INSERT INTO proactive_triggers (site_id, name, trigger_type, conditions, message_template)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      siteId,
      data.name,
      data.triggerType,
      JSON.stringify(data.conditions),
      data.messageTemplate,
    ],
  );
  return rows[0];
}

export async function deleteProactiveTrigger(
  siteId: string,
  triggerId: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM proactive_triggers WHERE id = $1 AND site_id = $2 RETURNING id`,
    [triggerId, siteId],
  );
  return rows.length > 0;
}

function matchesPattern(value: string, pattern: string): boolean {
  if (pattern.startsWith('*') && pattern.endsWith('*')) {
    return value.includes(pattern.slice(1, -1));
  }
  if (pattern.endsWith('*')) {
    return value.startsWith(pattern.slice(0, -1));
  }
  return value === pattern || value.includes(pattern);
}

export async function evaluateProactiveTriggers(
  input: ContextInput,
): Promise<{ message: string; triggerId: string } | null> {
  const triggers = await query<ProactiveTrigger>(
    `SELECT * FROM proactive_triggers WHERE site_id = $1 AND is_active = true`,
    [input.siteId],
  );

  for (const trigger of triggers) {
    const conditions = trigger.conditions as Record<string, unknown>;

    if (trigger.trigger_type === 'page_view' && input.pageUrl) {
      const pathPattern = String(conditions.pathPattern ?? conditions.path ?? '');
      if (pathPattern && matchesPattern(input.pageUrl, pathPattern)) {
        return { message: trigger.message_template, triggerId: trigger.id };
      }
    }

    if (trigger.trigger_type === 'idle') {
      const minIdle = Number(conditions.minIdleSeconds ?? conditions.idleSeconds ?? 60);
      if ((input.idleSeconds ?? 0) >= minIdle) {
        return { message: trigger.message_template, triggerId: trigger.id };
      }
    }

    if (trigger.trigger_type === 'custom_event' && input.event) {
      const eventName = String(conditions.eventName ?? conditions.event ?? '');
      if (eventName && input.event === eventName) {
        return { message: trigger.message_template, triggerId: trigger.id };
      }
    }
  }

  return null;
}
