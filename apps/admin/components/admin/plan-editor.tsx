'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Plan, PlanLimits, PlatformPlan } from '@nexus/shared-types';
import { Button, Input, Textarea } from '@/components/admin/ui/button';
import { Panel, PanelBody, PanelHeader } from '@/components/admin/ui/panel';
import { Badge } from '@/components/admin/ui/badge';

export function PlanEditor({ plan }: { plan: PlatformPlan }) {
  const router = useRouter();
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? '');
  const [limits, setLimits] = useState<PlanLimits>(plan.plan_limits);
  const [stripePriceId, setStripePriceId] = useState(plan.stripe_price_id ?? '');
  const [isPublic, setIsPublic] = useState(plan.is_public);
  const [syncTenants, setSyncTenants] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const res = await fetch(`/api/platform/plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: description || null,
        plan_limits: limits,
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
        <form onSubmit={onSubmit} className="space-y-4">
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Max sites"
              type="number"
              min={1}
              value={limits.max_sites}
              onChange={(e) =>
                setLimits({ ...limits, max_sites: parseInt(e.target.value, 10) || 1 })
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
                  max_conversations_month: parseInt(e.target.value, 10) || 1,
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
                  max_tokens_month: parseInt(e.target.value, 10) || 1,
                })
              }
            />
          </div>
          <label className="flex items-center gap-2 font-mono text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Public (shown in signup / billing)
          </label>
          <label className="flex items-center gap-2 font-mono text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={syncTenants}
              onChange={(e) => setSyncTenants(e.target.checked)}
            />
            Sync new limits to all tenants currently on this plan
          </label>
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
