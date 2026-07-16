'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OpenApiSourceType, OpenApiSourceTypeRouting } from '@nexus/shared-types';
import { Button } from '@/components/admin/ui/button';
import { Badge } from '@/components/admin/ui/badge';
import { Panel, PanelBody, PanelHeader } from '@/components/admin/ui/panel';

const SPECIALISTS = ['billing', 'technical', 'sales', 'account'] as const;

export function SourceTypeEditor({ type }: { type: OpenApiSourceType }) {
  const router = useRouter();
  const [name, setName] = useState(type.name);
  const [description, setDescription] = useState(type.description ?? '');
  const [sortOrder, setSortOrder] = useState(type.sort_order);
  const [isActive, setIsActive] = useState(type.is_active);
  const [alwaysInclude, setAlwaysInclude] = useState(
    type.routing?.alwaysInclude === true,
  );
  const [specialists, setSpecialists] = useState<string[]>(
    type.routing?.specialists ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function toggleSpecialist(s: string) {
    setSpecialists((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    const routing: OpenApiSourceTypeRouting = {
      alwaysInclude,
      specialists: specialists as OpenApiSourceTypeRouting['specialists'],
    };
    const res = await fetch(`/api/platform/source-types/${type.key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: description || null,
        sort_order: sortOrder,
        is_active: isActive,
        routing,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'Update failed');
      return;
    }
    setMessage('Source type saved');
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete source type "${type.key}"? Sites using it must be unlinked first.`)) {
      return;
    }
    setDeleting(true);
    setError('');
    const res = await fetch(`/api/platform/source-types/${type.key}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      setError(data.error ?? 'Delete failed');
      return;
    }
    router.refresh();
  }

  return (
    <Panel>
      <PanelHeader
        code={type.key}
        title={name}
        subtitle={description || undefined}
        action={
          <Badge variant={isActive ? 'success' : 'danger'} size="sm" dot>
            {isActive ? 'active' : 'inactive'}
          </Badge>
        }
      />
      <PanelBody className="space-y-4">
        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Display name
          </span>
          <input
            className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Description
          </span>
          <textarea
            className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Sort order
          </span>
          <input
            type="number"
            className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
          />
        </label>
        <label className="flex items-center gap-2 font-mono text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active (shown in tenant dashboard)
        </label>
        <label className="flex items-center gap-2 font-mono text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={alwaysInclude}
            onChange={(e) => setAlwaysInclude(e.target.checked)}
          />
          Always include tools in chat (e.g. FAQ)
        </label>
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Prefer for specialists
          </p>
          <div className="flex flex-wrap gap-2">
            {SPECIALISTS.map((s) => {
              const active = specialists.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpecialist(s)}
                  className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                    active
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-500'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
        {error && <p className="font-mono text-xs text-red-400">ERR: {error}</p>}
        {message && <p className="font-mono text-xs text-emerald-400">{message}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save type'}
          </Button>
          <Button size="sm" variant="secondary" onClick={remove} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </PanelBody>
    </Panel>
  );
}

export function SourceTypeCreateForm() {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    setSaving(true);
    setError('');
    const res = await fetch('/api/platform/source-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        name,
        description: description || null,
        routing: { specialists: [], alwaysInclude: false },
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'Create failed');
      return;
    }
    setKey('');
    setName('');
    setDescription('');
    router.refresh();
  }

  return (
    <Panel>
      <PanelHeader code="new" title="Add source type" subtitle="Available to all tenants for OpenAPI URLs" />
      <PanelBody className="space-y-3">
        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Key (slug)
          </span>
          <input
            className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200"
            placeholder="knowledge_base"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Name
          </span>
          <input
            className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200"
            placeholder="Knowledge Base"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Description
          </span>
          <input
            className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error && <p className="font-mono text-xs text-red-400">ERR: {error}</p>}
        <Button size="sm" onClick={create} disabled={saving || !key || !name}>
          {saving ? 'Creating…' : 'Create type'}
        </Button>
      </PanelBody>
    </Panel>
  );
}
