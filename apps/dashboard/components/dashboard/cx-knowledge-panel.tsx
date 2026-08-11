'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import type { CxKnowledgeItem } from '@nexus/shared-types';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { Button, Input, Textarea } from '@/components/dashboard/ui/button';

type Draft = { title: string; body: string; category: string };

const emptyDraft = (): Draft => ({ title: '', body: '', category: 'faq' });

export function CxKnowledgePanel({
  cxAgentId,
  canManage,
}: {
  cxAgentId: string;
  canManage: boolean;
}) {
  const [agentItems, setAgentItems] = useState<CxKnowledgeItem[]>([]);
  const [sharedItems, setSharedItems] = useState<CxKnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft());

  async function load() {
    setLoading(true);
    const [agentRes, sharedRes] = await Promise.all([
      fetch(`/api/cx-agents/knowledge?cxAgentId=${encodeURIComponent(cxAgentId)}`, {
        cache: 'no-store',
      }),
      fetch('/api/cx-agents/knowledge?shared=true', { cache: 'no-store' }),
    ]);
    const agentData = (await agentRes.json().catch(() => ({}))) as {
      items?: CxKnowledgeItem[];
      error?: string;
    };
    const sharedData = (await sharedRes.json().catch(() => ({}))) as {
      items?: CxKnowledgeItem[];
    };
    setLoading(false);
    if (!agentRes.ok) {
      setError(agentData.error ?? 'Failed to load knowledge');
      return;
    }
    setAgentItems(agentData.items ?? []);
    setSharedItems((sharedData.items ?? []).filter((i) => i.is_active));
    setError(null);
  }

  useEffect(() => {
    void load();
  }, [cxAgentId]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/cx-agents/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cxAgentId,
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

  async function remove(id: string) {
    if (!canManage) return;
    const res = await fetch(`/api/cx-agents/knowledge/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Delete failed');
      return;
    }
    await load();
  }

  function renderItem(item: CxKnowledgeItem, opts: { editable: boolean }) {
    if (opts.editable && editingId === item.id) {
      return (
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
            <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-200">{item.title}</p>
          <p className="font-mono text-[10px] uppercase text-zinc-500">{item.category}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400 whitespace-pre-wrap">{item.body}</p>
        </div>
        {opts.editable && canManage && (
          <div className="flex shrink-0 gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => startEdit(item)}>
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={() => void remove(item.id)}>
              Delete
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Panel>
      <PanelHeader
        title="Knowledge"
        subtitle="FAQ and product facts this CX Agent can use as ground truth"
      />
      <PanelBody>
        <p className="mb-4 text-xs leading-5 text-zinc-500">
          Short factual snippets work best. Shared defaults apply to every agent; items below are
          only for this agent.
        </p>

        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              Inherited defaults ({sharedItems.length})
            </p>
            <Link
              href="/app/cx-agents#default-knowledge"
              className="text-xs text-emerald-400/90 hover:text-emerald-300"
            >
              Edit defaults
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : sharedItems.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-3 text-xs text-zinc-500">
              No shared defaults yet. Install starter defaults from the CX Agents page, then edit
              them for your business.
            </p>
          ) : (
            <ul className="space-y-2">
              {sharedItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-zinc-800/80 bg-zinc-950/30 px-3 py-2"
                >
                  {renderItem(item, { editable: false })}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-4 border-t border-zinc-800 pt-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            This agent only
          </p>

          {canManage && (
            <form onSubmit={onAdd} className="mb-6 space-y-3 rounded-lg border border-zinc-800 p-3">
              <Input
                label="Title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Refund policy"
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
                placeholder="Refunds are processed within 5–7 business days…"
                required
              />
              <Button type="submit" disabled={saving} size="sm">
                {saving ? 'Adding…' : 'Add knowledge'}
              </Button>
            </form>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? null : agentItems.length === 0 ? (
          <p className="text-sm text-zinc-500">No agent-specific knowledge yet.</p>
        ) : (
          <ul className="space-y-3">
            {agentItems.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5"
              >
                {renderItem(item, { editable: true })}
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}
