'use client';

import { useEffect, useState } from 'react';
import type { CxConsult } from '@nexus/shared-types';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { Badge } from '@/components/dashboard/ui/badge';
import { formatDateTime } from '@/lib/datetime';

function statusVariant(status: CxConsult['status']) {
  if (status === 'completed') return 'success' as const;
  if (status === 'failed' || status === 'timeout') return 'danger' as const;
  if (status === 'running') return 'info' as const;
  return 'default' as const;
}

export function CxConsultsPanel({
  cxAgentId,
  initialConsults,
}: {
  cxAgentId?: string;
  initialConsults?: CxConsult[];
}) {
  const [consults, setConsults] = useState<CxConsult[]>(initialConsults ?? []);
  const [loading, setLoading] = useState(!initialConsults);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (initialConsults) {
      setConsults(initialConsults);
      setLoading(false);
      return;
    }
    async function load() {
      setLoading(true);
      const qs = cxAgentId ? `?cxAgentId=${encodeURIComponent(cxAgentId)}` : '';
      const res = await fetch(`/api/cx-agents/consults${qs}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { consults?: CxConsult[] };
      setConsults(data.consults ?? []);
      setLoading(false);
    }
    void load();
  }, [cxAgentId, initialConsults]);

  return (
    <Panel>
      <PanelHeader
        title="Specialist consults"
        subtitle="When this CX Agent asks Billing, Technical, Sales, or Account for help"
      />
      <PanelBody>
        <p className="mb-4 text-xs leading-5 text-zinc-500">
          Consults are internal only — visitors never see these threads. The CX Agent stays in the
          chat and uses the specialist brief to reply.
        </p>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : consults.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No consults yet. They appear when an active CX Agent calls a specialist during a live
            chat.
          </p>
        ) : (
          <ul className="space-y-3">
            {consults.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(c.status)} size="sm">
                      {c.status}
                    </Badge>
                    <span className="font-mono text-xs text-emerald-400/90">{c.target_key}</span>
                    <span className="font-mono text-[10px] text-zinc-600">
                      {c.consult_type}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-600">
                    {formatDateTime(c.created_at)}
                    {c.latency_ms != null ? ` · ${c.latency_ms}ms` : ''}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-300 line-clamp-2">{c.question}</p>
                <button
                  type="button"
                  className="mt-1 text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                >
                  {expanded === c.id ? 'Hide details' : 'Show answer'}
                </button>
                {expanded === c.id && (
                  <div className="mt-2 space-y-2 border-t border-zinc-800 pt-2 text-xs leading-5 text-zinc-400">
                    {c.context_snippet && (
                      <p>
                        <span className="text-zinc-500">Context:</span> {c.context_snippet}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap text-zinc-300">
                      {c.answer ?? c.meta?.error?.toString() ?? '—'}
                    </p>
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
