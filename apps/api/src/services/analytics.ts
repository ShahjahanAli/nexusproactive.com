import { query, queryOne } from '../db';
import { getCurrentUsage, getTenantPlan } from './planLimits';
import { currentPeriodStart, getDisplayTimezone } from '../lib/timezone';

export interface TenantAnalytics {
  period: { start: string; label: string };
  usage: {
    conversations_count: number;
    tokens_used: number;
    max_conversations_month: number;
    max_tokens_month: number;
  };
  today: { conversations: number; tokens: number };
  totals: {
    sites: number;
    conversations: number;
    messages: number;
    action_executions: number;
    active_actions: number;
    product_signals: number;
    open_conversations: number;
  };
  visitors: {
    unique_total: number;
    unique_this_month: number;
    unique_today: number;
    active_now: number;
  };
  averages: {
    messages_per_conversation: number;
    tokens_per_conversation: number;
  };
  bySite: Array<{
    site_id: string;
    site_name: string;
    domain: string;
    conversations: number;
    messages: number;
    tokens_used: number;
    unique_visitors: number;
  }>;
  dailyUsage: Array<{
    date: string;
    conversations: number;
    tokens: number;
  }>;
  recentConversations: Array<{
    id: string;
    site_name: string;
    visitor_id: string;
    active_agent: string;
    message_count: number;
    tokens_used: number;
    created_at: string;
  }>;
  recentExecutions: Array<{
    id: string;
    site_name: string;
    operation_id: string;
    method: string;
    path: string;
    status: string;
    executed_at: string | null;
  }>;
}

export async function getTenantAnalytics(tenantId: string): Promise<TenantAnalytics> {
  const { limits } = await getTenantPlan(tenantId);
  const usage = await getCurrentUsage(tenantId);
  const start = currentPeriodStart();
  const tz = getDisplayTimezone();

  const todayRow = await queryOne<{ conversations: number; tokens: string }>(
    `SELECT COUNT(c.id)::int AS conversations, COALESCE(SUM(c.tokens_used), 0)::bigint AS tokens
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     WHERE s.tenant_id = $1
       AND (c.created_at AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date`,
    [tenantId, tz],
  );

  const totals = await queryOne<{
    sites: number;
    conversations: number;
    messages: number;
    action_executions: number;
    active_actions: number;
    product_signals: number;
    open_conversations: number;
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM sites WHERE tenant_id = $1) AS sites,
       (SELECT COUNT(*)::int FROM conversations c JOIN sites s ON s.id = c.site_id WHERE s.tenant_id = $1) AS conversations,
       (SELECT COUNT(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN sites s ON s.id = c.site_id WHERE s.tenant_id = $1) AS messages,
       (SELECT COUNT(*)::int FROM action_executions ae JOIN conversations c ON c.id = ae.conversation_id JOIN sites s ON s.id = c.site_id WHERE s.tenant_id = $1) AS action_executions,
       (SELECT COUNT(*)::int FROM actions a JOIN sites s ON s.id = a.site_id WHERE s.tenant_id = $1 AND a.is_active = true) AS active_actions,
       (SELECT COUNT(*)::int FROM product_signals ps JOIN sites s ON s.id = ps.site_id WHERE s.tenant_id = $1) AS product_signals,
       (SELECT COUNT(*)::int FROM conversations c JOIN sites s ON s.id = c.site_id WHERE s.tenant_id = $1 AND c.status = 'open') AS open_conversations`,
    [tenantId],
  );

  const convTotal = totals?.conversations ?? 0;
  const msgTotal = totals?.messages ?? 0;
  const tokenTotal = usage.tokens_used;

  const visitorStats = await queryOne<{
    unique_total: number;
    unique_this_month: number;
    unique_today: number;
    active_now: number;
  }>(
    `SELECT
       (SELECT COUNT(DISTINCT c.visitor_id)::int FROM conversations c
        JOIN sites s ON s.id = c.site_id WHERE s.tenant_id = $1) AS unique_total,
       (SELECT COUNT(DISTINCT c.visitor_id)::int FROM conversations c
        JOIN sites s ON s.id = c.site_id
        WHERE s.tenant_id = $1
          AND c.created_at >= DATE_TRUNC('month', NOW() AT TIME ZONE $2) AT TIME ZONE $2) AS unique_this_month,
       (SELECT COUNT(DISTINCT c.visitor_id)::int FROM conversations c
        JOIN sites s ON s.id = c.site_id
        WHERE s.tenant_id = $1
          AND (c.created_at AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date) AS unique_today,
       (SELECT COUNT(DISTINCT c.visitor_id)::int FROM conversations c
        JOIN sites s ON s.id = c.site_id
        JOIN messages m ON m.conversation_id = c.id
        WHERE s.tenant_id = $1 AND m.created_at >= NOW() - INTERVAL '15 minutes') AS active_now`,
    [tenantId, tz],
  );

  const bySite = await query<TenantAnalytics['bySite'][0]>(
    `SELECT s.id AS site_id, s.name AS site_name, s.domain,
            COUNT(DISTINCT c.id)::int AS conversations,
            COUNT(m.id)::int AS messages,
            COALESCE(SUM(c.tokens_used), 0)::int AS tokens_used,
            COUNT(DISTINCT c.visitor_id)::int AS unique_visitors
     FROM sites s
     LEFT JOIN conversations c ON c.site_id = s.id
     LEFT JOIN messages m ON m.conversation_id = c.id
     WHERE s.tenant_id = $1
     GROUP BY s.id, s.name, s.domain
     ORDER BY conversations DESC`,
    [tenantId],
  );

  const dailyUsage = await query<TenantAnalytics['dailyUsage'][0]>(
    `SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
            COUNT(c.id)::int AS conversations,
            COALESCE(SUM(c.tokens_used), 0)::int AS tokens
     FROM generate_series(
       ((NOW() AT TIME ZONE $2)::date - 6),
       (NOW() AT TIME ZONE $2)::date,
       '1 day'::interval
     ) AS d(day)
     LEFT JOIN conversations c
       ON (c.created_at AT TIME ZONE $2)::date = d.day::date
       AND c.site_id IN (SELECT id FROM sites WHERE tenant_id = $1)
     GROUP BY d.day
     ORDER BY d.day ASC`,
    [tenantId, tz],
  );

  const recentConversations = await query<TenantAnalytics['recentConversations'][0]>(
    `SELECT c.id, s.name AS site_name, c.visitor_id, c.active_agent,
            (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id) AS message_count,
            c.tokens_used, c.created_at
     FROM conversations c
     JOIN sites s ON s.id = c.site_id
     WHERE s.tenant_id = $1
     ORDER BY c.created_at DESC
     LIMIT 8`,
    [tenantId],
  );

  const recentExecutions = await query<TenantAnalytics['recentExecutions'][0]>(
    `SELECT ae.id, s.name AS site_name, a.operation_id, a.method, a.path, ae.status, ae.executed_at
     FROM action_executions ae
     JOIN actions a ON a.id = ae.action_id
     JOIN conversations c ON c.id = ae.conversation_id
     JOIN sites s ON s.id = c.site_id
     WHERE s.tenant_id = $1
     ORDER BY COALESCE(ae.executed_at, ae.created_at) DESC
     LIMIT 8`,
    [tenantId],
  );

  const periodLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${start}T12:00:00Z`));

  return {
    period: { start, label: periodLabel },
    usage: {
      conversations_count: usage.conversations_count,
      tokens_used: usage.tokens_used,
      max_conversations_month: limits.max_conversations_month,
      max_tokens_month: limits.max_tokens_month,
    },
    today: {
      conversations: todayRow?.conversations ?? 0,
      tokens: todayRow ? Number(todayRow.tokens) : 0,
    },
    totals: {
      sites: totals?.sites ?? 0,
      conversations: convTotal,
      messages: msgTotal,
      action_executions: totals?.action_executions ?? 0,
      active_actions: totals?.active_actions ?? 0,
      product_signals: totals?.product_signals ?? 0,
      open_conversations: totals?.open_conversations ?? 0,
    },
    visitors: {
      unique_total: visitorStats?.unique_total ?? 0,
      unique_this_month: visitorStats?.unique_this_month ?? 0,
      unique_today: visitorStats?.unique_today ?? 0,
      active_now: visitorStats?.active_now ?? 0,
    },
    averages: {
      messages_per_conversation: convTotal > 0 ? Math.round((msgTotal / convTotal) * 10) / 10 : 0,
      tokens_per_conversation: convTotal > 0 ? Math.round(tokenTotal / convTotal) : 0,
    },
    bySite,
    dailyUsage,
    recentConversations,
    recentExecutions,
  };
}
