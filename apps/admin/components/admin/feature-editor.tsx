'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FeatureFlag, Plan } from '@nexus/shared-types';
import { Button } from '@/components/admin/ui/button';
import { Badge } from '@/components/admin/ui/badge';
import { Panel, PanelBody, PanelHeader } from '@/components/admin/ui/panel';

const ALL_PLANS: Plan[] = ['trial', 'starter', 'growth', 'scale'];

export function FeatureEditor({ feature }: { feature: FeatureFlag }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(feature.enabled);
  const [plans, setPlans] = useState<Plan[]>(feature.plans ?? []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function togglePlan(plan: Plan) {
    setPlans((prev) =>
      prev.includes(plan) ? prev.filter((p) => p !== plan) : [...prev, plan],
    );
  }

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    const res = await fetch(`/api/platform/features/${feature.key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, plans }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'Update failed');
      return;
    }
    setMessage('Feature saved');
    router.refresh();
  }

  return (
    <Panel>
      <PanelHeader
        code={feature.key}
        title={feature.name}
        subtitle={feature.description ?? undefined}
        action={
          <Badge variant={enabled ? 'success' : 'danger'} size="sm" dot>
            {enabled ? 'on' : 'off'}
          </Badge>
        }
      />
      <PanelBody className="space-y-4">
        <label className="flex items-center gap-2 font-mono text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Globally enabled
        </label>
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Included plans
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_PLANS.map((plan) => {
              const active = plans.includes(plan);
              return (
                <button
                  key={plan}
                  type="button"
                  onClick={() => togglePlan(plan)}
                  className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                    active
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-500'
                  }`}
                >
                  {plan}
                </button>
              );
            })}
          </div>
        </div>
        {error && <p className="font-mono text-xs text-red-400">ERR: {error}</p>}
        {message && <p className="font-mono text-xs text-emerald-400">{message}</p>}
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save feature'}
        </Button>
      </PanelBody>
    </Panel>
  );
}
