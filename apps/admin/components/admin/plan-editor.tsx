'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Plan, PlanLimits, PlatformPlan } from '@nexus/shared-types';
import { Button, Input, Textarea } from '@/components/admin/ui/button';
import { Panel, PanelBody, PanelHeader } from '@/components/admin/ui/panel';
import { Badge } from '@/components/admin/ui/badge';

function num(v: string, fallback: number) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function PlanEditor({ plan }: { plan: PlatformPlan }) {
  const router = useRouter();
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? '');
  const [limits, setLimits] = useState<PlanLimits>(plan.plan_limits);
  const [stripePriceId, setStripePriceId] = useState(plan.stripe_price_id ?? '');
  const [isPublic, setIsPublic] = useState(plan.is_public);
  // Default on: editing a plan is nearly always meant to apply to accounts already on it.
  const [syncTenants, setSyncTenants] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    // Persist the values the form is showing, so unedited fields save their
    // displayed fallback instead of staying absent from the stored limits.
    const payload: PlanLimits = {
      ...limits,
      cx_agents_enabled: limits.cx_agents_enabled !== false,
      max_cx_agents: limits.max_cx_agents ?? 0,
      default_max_concurrent_chats: limits.default_max_concurrent_chats ?? 5,
      max_concurrent_chats_cap: limits.max_concurrent_chats_cap ?? 10,
      cx_knowledge_items_cap: limits.cx_knowledge_items_cap ?? 50,
      cx_specialist_consult_enabled: limits.cx_specialist_consult_enabled ?? true,
      cx_peer_consult_enabled: limits.cx_peer_consult_enabled ?? true,
      cx_ratings_enabled: limits.cx_ratings_enabled ?? true,
      cx_leaderboard_enabled: limits.cx_leaderboard_enabled ?? true,
      cx_live_graph_enabled: limits.cx_live_graph_enabled ?? true,
    };
    const res = await fetch(`/api/platform/plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: description || null,
        plan_limits: payload,
        stripe_price_id: stripePriceId || null,
        is_public: isPublic,
        sync_tenants: syncTenants,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'Update failed');
      return;
    }
    setMessage(
      data.synced
        ? `Plan saved — synced limits to ${data.synced} tenant(s)`
        : 'Plan saved',
    );
    router.refresh();
  }

  return (
    <Panel>
      <PanelHeader
        code={plan.id}
        title={plan.name}
        action={
          <Badge variant={plan.is_public ? 'success' : 'default'} size="sm">
            {plan.is_public ? 'public' : 'hidden'}
          </Badge>
        }
      />
      <PanelBody>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Stripe price ID"
              value={stripePriceId}
              onChange={(e) => setStripePriceId(e.target.value)}
              placeholder="price_..."
            />
          </div>
          <Textarea
            label="Description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              Core limits
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Max sites"
                type="number"
                min={1}
                value={limits.max_sites}
                onChange={(e) =>
                  setLimits({ ...limits, max_sites: num(e.target.value, 1) })
                }
              />
              <Input
                label="Conversations / mo"
                type="number"
                min={1}
                value={limits.max_conversations_month}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    max_conversations_month: num(e.target.value, 1),
                  })
                }
              />
              <Input
                label="Tokens / mo"
                type="number"
                min={1}
                value={limits.max_tokens_month}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    max_tokens_month: num(e.target.value, 1),
                  })
                }
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="mb-3">
              <p className="font-mono text-[11px] uppercase tracking-wider text-emerald-500/80">
                CX Agents
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Tenant-owned Customer Experience AI agents. These knobs control how many agents a
                subscriber can create and which advanced CX features their plan unlocks. Sync to
                tenants if you want existing accounts to inherit changes immediately.
              </p>
            </div>

            <label className="mb-4 flex items-center gap-2 font-mono text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={limits.cx_agents_enabled !== false}
                onChange={(e) =>
                  setLimits({ ...limits, cx_agents_enabled: e.target.checked })
                }
              />
              Enable CX Agents on this plan
            </label>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Max CX Agents / tenant"
                type="number"
                min={0}
                value={limits.max_cx_agents ?? 0}
                onChange={(e) =>
                  setLimits({ ...limits, max_cx_agents: num(e.target.value, 0) })
                }
              />
              <Input
                label="Default concurrent chats"
                type="number"
                min={1}
                value={limits.default_max_concurrent_chats ?? 5}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    default_max_concurrent_chats: num(e.target.value, 5),
                  })
                }
              />
              <Input
                label="Concurrent chats cap"
                type="number"
                min={1}
                value={limits.max_concurrent_chats_cap ?? 10}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    max_concurrent_chats_cap: num(e.target.value, 10),
                  })
                }
              />
              <Input
                label="Knowledge items cap"
                type="number"
                min={0}
                value={limits.cx_knowledge_items_cap ?? 50}
                onChange={(e) =>
                  setLimits({
                    ...limits,
                    cx_knowledge_items_cap: num(e.target.value, 50),
                  })
                }
              />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['cx_specialist_consult_enabled', 'Specialist consults (Billing, Technical, …)'],
                  ['cx_peer_consult_enabled', 'Peer CX Agent consults'],
                  ['cx_ratings_enabled', 'Visitor ratings'],
                  ['cx_leaderboard_enabled', 'CX leaderboard'],
                  ['cx_live_graph_enabled', 'Live connection graph'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 font-mono text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={Boolean(limits[key] ?? true)}
                    onChange={(e) => setLimits({ ...limits, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 font-mono text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Public (shown in signup / billing)
          </label>
          <div className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
            <label className="flex items-center gap-2 font-mono text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={syncTenants}
                onChange={(e) => setSyncTenants(e.target.checked)}
              />
              Apply these limits to tenants already on this plan
            </label>
            <p className="mt-1.5 text-xs leading-5 text-zinc-500">
              Each tenant stores its own copy of the limits. Leave this unchecked and the changes
              apply only to <em>new</em> accounts — existing tenants keep their current caps.
            </p>
          </div>
          {error && <p className="font-mono text-xs text-red-400">ERR: {error}</p>}
          {message && <p className="font-mono text-xs text-emerald-400">{message}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : `Save ${plan.id as Plan}`}
          </Button>
        </form>
      </PanelBody>
    </Panel>
  );
}
