'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CxAgent, PlanLimits, TenantRole } from '@nexus/shared-types';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { Badge } from '@/components/dashboard/ui/badge';
import { Button } from '@/components/dashboard/ui/button';

function statusVariant(status: CxAgent['status']) {
  if (status === 'active') return 'success' as const;
  if (status === 'paused') return 'warning' as const;
  return 'default' as const;
}

export function CxAgentsList({ currentRole }: { currentRole: TenantRole }) {
  const canManage = currentRole === 'owner' || currentRole === 'admin';
  const [agents, setAgents] = useState<CxAgent[]>([]);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/cx-agents', { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as {
      agents?: CxAgent[];
      limits?: PlanLimits;
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? 'Failed to load CX Agents');
      return;
    }
    setAgents(data.agents ?? []);
    setLimits(data.limits ?? null);
    setError(null);
  }

  useEffect(() => {
    void load();
  }, []);

  const maxAgents = limits?.max_cx_agents ?? 0;
  const enabled = limits?.cx_agents_enabled !== false;
  const atLimit = agents.length >= maxAgents;

  async function setStatus(id: string, status: CxAgent['status']) {
    setNotice(null);
    const res = await fetch(`/api/cx-agents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Update failed');
      return;
    }
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this CX Agent? Open chats will lose their assigned agent.')) return;
    setNotice(null);
    const res = await fetch(`/api/cx-agents/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Delete failed');
      return;
    }
    await load();
  }

  async function clone(id: string) {
    if (atLimit) {
      setError('Plan limit reached — upgrade or delete an agent before cloning.');
      return;
    }
    setCloningId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/cx-agents/${id}/clone`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as {
        agent?: CxAgent;
        knowledgeCopied?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'Clone failed');
        return;
      }
      const copied = data.knowledgeCopied ?? 0;
      const name = data.agent?.display_name ?? 'Copy';
      setNotice(
        copied > 0
          ? `Cloned as “${name}” (draft) with ${copied} knowledge item${copied === 1 ? '' : 's'}. Rename and activate when ready.`
          : `Cloned as “${name}” (draft). Rename and activate when ready.`,
      );
      await load();
    } finally {
      setCloningId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm leading-6 text-zinc-400">
        <p className="font-medium text-zinc-200">How CX Agents work</p>
        <p className="mt-1">
          Each CX Agent is a customer-facing AI persona for your whole account. It owns live chats
          up to its concurrent capacity, answers FAQ/product questions, and can call platform
          specialists (Billing, Technical, Sales, Account) when it needs domain skills. Use{' '}
          <span className="text-zinc-300">Clone</span> to spin up more agents from a working
          template (up to your plan limit) — copies start as drafts so you can rename before
          activating. Human agents remain available via Support Inbox for escalations.
        </p>
      </div>

      {!enabled && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          CX Agents are disabled on your plan. Ask your platform admin to enable them, or upgrade.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-zinc-500">
          {agents.length} / {maxAgents} agents on plan
          {limits?.default_max_concurrent_chats
            ? ` · default capacity ${limits.default_max_concurrent_chats} chats`
            : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/app/cx-agents/live">
            <Button variant="secondary" size="sm">
              Live graph
            </Button>
          </Link>
          <Link href="/app/cx-agents/leaderboard">
            <Button variant="secondary" size="sm">
              Leaderboard
            </Button>
          </Link>
          {canManage && enabled && (
            <Link href="/app/cx-agents/new">
              <Button disabled={atLimit} title={atLimit ? 'Plan limit reached' : undefined}>
                Create CX Agent
              </Button>
            </Link>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : agents.length === 0 ? (
        <Panel>
          <PanelBody>
            <p className="text-sm text-zinc-300">No CX Agents yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Create your first agent in a short guided setup — name, role, capacity, and which
              specialists it may call.
            </p>
            {canManage && enabled && (
              <div className="mt-4">
                <Link href="/app/cx-agents/new">
                  <Button>Start setup wizard</Button>
                </Link>
              </div>
            )}
          </PanelBody>
        </Panel>
      ) : (
        <div className="grid gap-4">
          {agents.map((agent) => (
            <Panel key={agent.id}>
              <PanelHeader
                title={agent.display_name}
                subtitle={agent.slug}
                action={
                  <Badge variant={statusVariant(agent.status)} size="sm">
                    {agent.status}
                  </Badge>
                }
              />
              <PanelBody>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1 text-sm text-zinc-400">
                    <p>
                      <span className="text-zinc-500">Internal name:</span> {agent.name}
                    </p>
                    {agent.role_summary && <p>{agent.role_summary}</p>}
                    <p className="font-mono text-xs text-zinc-500">
                      {agent.active_chats ?? 0} / {agent.max_concurrent_chats} active chats ·
                      specialists: {(agent.allowed_specialists ?? []).join(', ') || 'none'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/app/cx-agents/${agent.id}`}>
                      <Button variant="secondary" size="sm">
                        {canManage ? 'Edit' : 'View'}
                      </Button>
                    </Link>
                    {canManage && enabled && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={atLimit || cloningId === agent.id}
                        title={
                          atLimit
                            ? `Plan allows ${maxAgents} CX Agent(s)`
                            : 'Duplicate this agent (starts as draft)'
                        }
                        onClick={() => void clone(agent.id)}
                      >
                        {cloningId === agent.id ? 'Cloning…' : 'Clone'}
                      </Button>
                    )}
                    {canManage && agent.status !== 'active' && (
                      <Button size="sm" onClick={() => void setStatus(agent.id, 'active')}>
                        Activate
                      </Button>
                    )}
                    {canManage && agent.status === 'active' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void setStatus(agent.id, 'paused')}
                      >
                        Pause
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void remove(agent.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </PanelBody>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
