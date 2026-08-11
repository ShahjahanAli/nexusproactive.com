'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { CxKnowledgeItem } from '@nexus/shared-types';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { Button, Input, Textarea } from '@/components/dashboard/ui/button';

type Draft = { title: string; body: string; category: string };

const emptyDraft = (): Draft => ({ title: '', body: '', category: 'faq' });

export function CxDefaultKnowledgePanel({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<CxKnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft());

  async function load() {
    setLoading(true);
    const res = await fetch('/api/cx-agents/knowledge?shared=true', { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as {
      items?: CxKnowledgeItem[];
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? 'Failed to load default knowledge');
      return;
    }
    setItems(data.items ?? []);
    setError(null);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const res = await fetch('/api/cx-agents/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cxAgentId: null,
        title: draft.title,
        body: draft.body,
        category: draft.category,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'Could not add item');
      return;
    }
    setDraft(emptyDraft());
    await load();
  }

  async function seedDefaults() {
    if (!canManage) return;
    setSeeding(true);
    setError(null);
    setNotice(null);
    const res = await fetch('/api/cx-agents/knowledge/seed-defaults', { method: 'POST' });
    const data = (await res.json().catch(() => ({}))) as {
      created?: number;
      skipped?: number;
      error?: string;
    };
    setSeeding(false);
    if (!res.ok) {
      setError(data.error ?? 'Could not install defaults');
      return;
    }
    const created = data.created ?? 0;
    const skipped = data.skipped ?? 0;
    setNotice(
      created > 0
        ? `Installed ${created} default item${created === 1 ? '' : 's'}${
            skipped ? ` (${skipped} already present)` : ''
          }. Edit each one to match your business.`
        : skipped
          ? 'Starter defaults are already installed — edit them below.'
          : 'No defaults were installed (knowledge cap may be full).',
    );
    await load();
  }

  function startEdit(item: CxKnowledgeItem) {
    setEditingId(item.id);
    setEditDraft({
      title: item.title,
      body: item.body,
      category: item.category,
    });
  }

  async function saveEdit(id: string) {
    if (!canManage) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/cx-agents/knowledge/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editDraft),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? 'Update failed');
      return;
    }
    setEditingId(null);
    await load();
  }

  async function toggleActive(item: CxKnowledgeItem) {
    if (!canManage) return;
    const res = await fetch(`/api/cx-agents/knowledge/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !item.is_active }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Update failed');
      return;
    }
    await load();
  }

  async function remove(id: string) {
    if (!canManage) return;
    if (!confirm('Remove this default knowledge item from all CX Agents?')) return;
    const res = await fetch(`/api/cx-agents/knowledge/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Delete failed');
      return;
    }
    await load();
  }

  return (
    <Panel>
      <PanelHeader
        title="Default knowledge"
        subtitle="Shared by every CX Agent on this account — edit once, all agents use it"
        action={
          canManage ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={seeding}
              onClick={() => void seedDefaults()}
            >
              {seeding ? 'Installing…' : 'Install starter defaults'}
            </Button>
          ) : undefined
        }
      />
      <PanelBody>
        <p className="mb-4 text-xs leading-5 text-zinc-500">
          Defaults are ground-truth FAQ and policy snippets injected into every CX Agent. Install
          the starter set, then rewrite each item for your products, hours, and policies. Agent-only
          knowledge still lives on each agent’s edit page.
        </p>

        {canManage && (
          <form onSubmit={onAdd} className="mb-6 space-y-3 rounded-lg border border-zinc-800 p-3">
            <Input
              label="Title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Business hours"
              required
            />
            <Input
              label="Category"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="faq / product / policy"
            />
            <Textarea
              label="Content"
              rows={3}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="We are open Monday–Friday…"
              required
            />
            <Button type="submit" disabled={saving} size="sm">
              {saving ? 'Saving…' : 'Add default'}
            </Button>
          </form>
        )}

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {notice && <p className="mb-3 text-sm text-emerald-400">{notice}</p>}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-center">
            <p className="text-sm text-zinc-300">No default knowledge yet</p>
            <p className="mt-1 text-xs text-zinc-500">
              Install starter defaults, or add your own FAQ and policy items above.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className={`rounded-lg border px-3 py-2.5 ${
                  item.is_active
                    ? 'border-zinc-800 bg-zinc-950/40'
                    : 'border-zinc-800/60 bg-zinc-950/20 opacity-70'
                }`}
              >
                {editingId === item.id ? (
                  <div className="space-y-3">
                    <Input
                      label="Title"
                      value={editDraft.title}
                      onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                      required
                    />
                    <Input
                      label="Category"
                      value={editDraft.category}
                      onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
                    />
                    <Textarea
                      label="Content"
                      rows={4}
                      value={editDraft.body}
                      onChange={(e) => setEditDraft({ ...editDraft, body: e.target.value })}
                      required
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={saving} onClick={() => void saveEdit(item.id)}>
                        {saving ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                      <p className="font-mono text-[10px] uppercase text-zinc-500">
                        {item.category}
                        {!item.is_active ? ' · paused' : ''}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-400 whitespace-pre-wrap">
                        {item.body}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void toggleActive(item)}
                        >
                          {item.is_active ? 'Pause' : 'Enable'}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => void remove(item.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}
