'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Plan, PlanLimits, TenantStatus } from '@nexus/shared-types';
import { Button, Input, Select, Textarea } from '@/components/admin/ui/button';

export function TenantEditForm({
  tenantId,
  initial,
}: {
  tenantId: string;
  initial: {
    plan: Plan;
    status: TenantStatus;
    notes: string | null;
    plan_limits: PlanLimits;
  };
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(initial.plan);
  const [status, setStatus] = useState(initial.status);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [limits, setLimits] = useState(initial.plan_limits);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const res = await fetch(`/api/platform/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan,
        status,
        notes: notes || null,
        plan_limits: limits,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'Update failed');
      return;
    }
    setMessage('Tenant updated');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value as Plan)}
        >
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="scale">Scale</option>
        </Select>
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as TenantStatus)}
        >
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="churned">Churned</option>
        </Select>
      </div>

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
          label="Max conversations / mo"
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
          label="Max tokens / mo"
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

      <Textarea
        label="Internal notes"
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {error && (
        <p className="font-mono text-xs text-red-400">ERR: {error}</p>
      )}
      {message && (
        <p className="font-mono text-xs text-emerald-400">{message}</p>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save tenant'}
      </Button>
    </form>
  );
}
