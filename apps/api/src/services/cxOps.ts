import type { CxAgent } from '@nexus/shared-types';
import { query } from '../db';
import { getTenantPlan } from './planLimits';
import { listCxAgents } from './cxAgents';

export type GraphNodeKind = 'cx_agent' | 'customer' | 'specialist' | 'human';
export type GraphEdgeKind = 'owns' | 'consult' | 'escalation' | 'peer';

export interface CxGraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  sublabel?: string;
  meta?: Record<string, unknown>;
}

export interface CxGraphEdge {
  id: string;
  from: string;
  to: string;
  kind: GraphEdgeKind;
  label?: string;
  active?: boolean;
}

export interface CxLiveGraph {
  generated_at: string;
  nodes: CxGraphNode[];
  edges: CxGraphEdge[];
  enabled: boolean;
}

export interface CxLeaderboardRow {
  cx_agent_id: string;
  name: string;
  display_name: string;
  status: string;
  chats_handled: number;
  active_chats: number;
  avg_rating: number | null;
  rating_count: number;
  sales_events: number;
  specialist_consults: number;
  human_escalations: number;
  consults_helped: number;
}

export interface CxLeaderboard {
  period: 'today' | '7d' | '30d';
  generated_at: string;
  enabled: boolean;
  rows: CxLeaderboardRow[];
}

function periodStart(period: 'today' | '7d' | '30d'): Date {
  const now = new Date();
  if (period === 'today') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const days = period === '7d' ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function getCxLiveGraph(tenantId: string): Promise<CxLiveGraph> {
  const { limits } = await getTenantPlan(tenantId);
  const enabled = limits.cx_live_graph_enabled !== false && limits.cx_agents_enabled !== false;
  if (!enabled) {
    return { generated_at: new Date().toISOString(), nodes: [], edges: [], enabled: false };
  }

  const agents = await listCxAgents(tenantId);
  const activeAgents = agents.filter((a) => a.status === 'active' || (a.active_chats ?? 0) > 0);

  const conversations = await query<{
    id: string;
    visitor_id: string;
    status: string;
    cx_agent_id: string;
    assigned_to: string | null;
    active_agent: string | null;
  }>(
    `SELECT c.id, c.visitor_id, c.status, c.cx_agent_id, c.assigned_to, c.active_agent
     FROM conversations c
     INNER JOIN sites s ON s.id = c.site_id
     WHERE s.tenant_id = $1
       AND c.cx_agent_id IS NOT NULL
       AND c.status IN ('open', 'escalated', 'human')
     ORDER BY c.created_at DESC
     LIMIT 80`,
    [tenantId],
  );

  const recentConsults = await query<{
    id: string;
    from_cx_agent_id: string;
    target_key: string;
    status: string;
    consult_type: string;
  }>(
    `SELECT id, from_cx_agent_id, target_key, status, consult_type
     FROM cx_consults
     WHERE tenant_id = $1
       AND created_at > now() - interval '30 minutes'
     ORDER BY created_at DESC
     LIMIT 60`,
    [tenantId],
  );

  const humans = await query<{
    id: string;
    email: string;
    display_name: string | null;
  }>(
    `SELECT id, email, display_name FROM tenant_users
     WHERE tenant_id = $1 AND role = 'agent' AND COALESCE(is_active, true) = true`,
    [tenantId],
  );

  const nodes: CxGraphNode[] = [];
  const edges: CxGraphEdge[] = [];
  const nodeIds = new Set<string>();

  const addNode = (n: CxGraphNode) => {
    if (nodeIds.has(n.id)) return;
    nodeIds.add(n.id);
    nodes.push(n);
  };

  for (const a of activeAgents.length ? activeAgents : agents.slice(0, 10)) {
    addNode({
      id: `cx:${a.id}`,
      kind: 'cx_agent',
      label: a.display_name,
      sublabel: `${a.active_chats ?? 0}/${a.max_concurrent_chats} chats · ${a.status}`,
      meta: { agentId: a.id, slug: a.slug, status: a.status },
    });
  }

  for (const spec of ['billing', 'technical', 'sales', 'account'] as const) {
    addNode({
      id: `spec:${spec}`,
      kind: 'specialist',
      label: spec.charAt(0).toUpperCase() + spec.slice(1),
      sublabel: 'platform specialist',
    });
  }

  for (const h of humans) {
    addNode({
      id: `human:${h.id}`,
      kind: 'human',
      label: h.display_name?.trim() || h.email.split('@')[0],
      sublabel: h.email,
      meta: { userId: h.id },
    });
  }

  for (const c of conversations) {
    const short = c.visitor_id.length > 10 ? `${c.visitor_id.slice(0, 8)}…` : c.visitor_id;
    addNode({
      id: `cust:${c.id}`,
      kind: 'customer',
      label: short,
      sublabel: c.status,
      meta: { conversationId: c.id, status: c.status },
    });
    edges.push({
      id: `owns:${c.cx_agent_id}:${c.id}`,
      from: `cx:${c.cx_agent_id}`,
      to: `cust:${c.id}`,
      kind: 'owns',
      label: 'chat',
      active: c.status === 'open',
    });

    if (c.assigned_to && (c.status === 'human' || c.status === 'escalated')) {
      addNode({
        id: `human:${c.assigned_to}`,
        kind: 'human',
        label: humans.find((h) => h.id === c.assigned_to)?.display_name
          || humans.find((h) => h.id === c.assigned_to)?.email.split('@')[0]
          || 'Human agent',
        meta: { userId: c.assigned_to },
      });
      edges.push({
        id: `esc:${c.cx_agent_id}:${c.assigned_to}:${c.id}`,
        from: `cx:${c.cx_agent_id}`,
        to: `human:${c.assigned_to}`,
        kind: 'escalation',
        label: c.status === 'human' ? 'claimed' : 'queued',
        active: true,
      });
    } else if (c.status === 'escalated') {
      // Pending human — connect to a virtual queue node once
      addNode({
        id: 'human:queue',
        kind: 'human',
        label: 'Human queue',
        sublabel: 'waiting for claim',
      });
      edges.push({
        id: `escq:${c.cx_agent_id}:${c.id}`,
        from: `cx:${c.cx_agent_id}`,
        to: 'human:queue',
        kind: 'escalation',
        label: 'queued',
        active: true,
      });
    }

    // Soft link to current specialist skill if set
    if (
      c.active_agent &&
      ['billing', 'technical', 'sales', 'account'].includes(c.active_agent)
    ) {
      edges.push({
        id: `skill:${c.cx_agent_id}:${c.active_agent}:${c.id}`,
        from: `cx:${c.cx_agent_id}`,
        to: `spec:${c.active_agent}`,
        kind: 'consult',
        label: 'using',
        active: false,
      });
    }
  }

  for (const consult of recentConsults) {
    if (consult.consult_type === 'specialist') {
      const to = `spec:${consult.target_key}`;
      addNode({
        id: to,
        kind: 'specialist',
        label: consult.target_key,
      });
      edges.push({
        id: `consult:${consult.id}`,
        from: `cx:${consult.from_cx_agent_id}`,
        to,
        kind: 'consult',
        label: consult.status,
        active: consult.status === 'running' || consult.status === 'pending',
      });
    } else if (consult.consult_type === 'peer_cx') {
      edges.push({
        id: `peer:${consult.id}`,
        from: `cx:${consult.from_cx_agent_id}`,
        to: `cx:${consult.target_key}`,
        kind: 'peer',
        label: 'peer',
        active: consult.status === 'running',
      });
    }
  }

  // Ensure CX nodes referenced by edges exist
  for (const e of edges) {
    for (const end of [e.from, e.to]) {
      if (end.startsWith('cx:') && !nodeIds.has(end)) {
        const id = end.slice(3);
        const a = agents.find((x) => x.id === id);
        addNode({
          id: end,
          kind: 'cx_agent',
          label: a?.display_name ?? 'CX Agent',
          sublabel: a?.status,
        });
      }
    }
  }

  return {
    generated_at: new Date().toISOString(),
    nodes,
    edges,
    enabled: true,
  };
}

export async function getCxLeaderboard(
  tenantId: string,
  period: 'today' | '7d' | '30d' = '7d',
): Promise<CxLeaderboard> {
  const { limits } = await getTenantPlan(tenantId);
  const enabled =
    limits.cx_leaderboard_enabled !== false && limits.cx_agents_enabled !== false;
  if (!enabled) {
    return {
      period,
      generated_at: new Date().toISOString(),
      enabled: false,
      rows: [],
    };
  }

  const agents = await listCxAgents(tenantId);
  const since = periodStart(period);

  const chatCounts = await query<{ cx_agent_id: string; count: string }>(
    `SELECT c.cx_agent_id, COUNT(*)::text AS count
     FROM conversations c
     INNER JOIN sites s ON s.id = c.site_id
     WHERE s.tenant_id = $1
       AND c.cx_agent_id IS NOT NULL
       AND c.created_at >= $2
     GROUP BY c.cx_agent_id`,
    [tenantId, since.toISOString()],
  );

  const escalationCounts = await query<{ cx_agent_id: string; count: string }>(
    `SELECT c.cx_agent_id, COUNT(*)::text AS count
     FROM conversations c
     INNER JOIN sites s ON s.id = c.site_id
     WHERE s.tenant_id = $1
       AND c.cx_agent_id IS NOT NULL
       AND c.escalated_at IS NOT NULL
       AND c.escalated_at >= $2
     GROUP BY c.cx_agent_id`,
    [tenantId, since.toISOString()],
  );

  const ratingStats = await query<{
    cx_agent_id: string;
    avg: string;
    count: string;
  }>(
    `SELECT cx_agent_id, AVG(score)::text AS avg, COUNT(*)::text AS count
     FROM cx_agent_ratings
     WHERE tenant_id = $1 AND created_at >= $2
     GROUP BY cx_agent_id`,
    [tenantId, since.toISOString()],
  );

  const salesCounts = await query<{ cx_agent_id: string; count: string }>(
    `SELECT cx_agent_id, COUNT(*)::text AS count
     FROM cx_sales_events
     WHERE tenant_id = $1 AND created_at >= $2
     GROUP BY cx_agent_id`,
    [tenantId, since.toISOString()],
  );

  const consultCounts = await query<{ from_cx_agent_id: string; count: string }>(
    `SELECT from_cx_agent_id, COUNT(*)::text AS count
     FROM cx_consults
     WHERE tenant_id = $1 AND created_at >= $2 AND consult_type = 'specialist'
     GROUP BY from_cx_agent_id`,
    [tenantId, since.toISOString()],
  );

  const mapCount = (rows: Array<{ [k: string]: string }>, key: string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r[key], parseInt(r.count, 10) || 0);
    return m;
  };

  const chats = mapCount(chatCounts as Array<{ cx_agent_id: string; count: string }>, 'cx_agent_id');
  const escalations = mapCount(
    escalationCounts as Array<{ cx_agent_id: string; count: string }>,
    'cx_agent_id',
  );
  const sales = mapCount(salesCounts as Array<{ cx_agent_id: string; count: string }>, 'cx_agent_id');
  const consults = mapCount(
    consultCounts as Array<{ from_cx_agent_id: string; count: string }>,
    'from_cx_agent_id',
  );
  const ratings = new Map<string, { avg: number; count: number }>();
  for (const r of ratingStats) {
    ratings.set(r.cx_agent_id, {
      avg: Number(r.avg),
      count: parseInt(r.count, 10) || 0,
    });
  }

  const rows: CxLeaderboardRow[] = agents.map((a: CxAgent) => {
    const r = ratings.get(a.id);
    return {
      cx_agent_id: a.id,
      name: a.name,
      display_name: a.display_name,
      status: a.status,
      chats_handled: chats.get(a.id) ?? 0,
      active_chats: a.active_chats ?? 0,
      avg_rating: r ? Math.round(r.avg * 10) / 10 : null,
      rating_count: r?.count ?? 0,
      sales_events: sales.get(a.id) ?? 0,
      specialist_consults: consults.get(a.id) ?? 0,
      human_escalations: escalations.get(a.id) ?? 0,
      consults_helped: 0,
    };
  });

  rows.sort((a, b) => {
    if (b.chats_handled !== a.chats_handled) return b.chats_handled - a.chats_handled;
    if ((b.avg_rating ?? 0) !== (a.avg_rating ?? 0)) {
      return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
    }
    return b.sales_events - a.sales_events;
  });

  return {
    period,
    generated_at: new Date().toISOString(),
    enabled: true,
    rows,
  };
}
