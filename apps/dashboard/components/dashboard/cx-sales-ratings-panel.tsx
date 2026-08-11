'use client';

import { useEffect, useState } from 'react';
import type { CxAgentRating, CxSalesEvent } from '@nexus/shared-types';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { Badge } from '@/components/dashboard/ui/badge';
import { formatDateTime } from '@/lib/datetime';

export function CxSalesRatingsPanel({ cxAgentId }: { cxAgentId: string }) {
  const [ratings, setRatings] = useState<CxAgentRating[]>([]);
  const [events, setEvents] = useState<CxSalesEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const qs = `cxAgentId=${encodeURIComponent(cxAgentId)}`;
      const [rRes, sRes] = await Promise.all([
        fetch(`/api/cx-agents/ratings?${qs}`, { cache: 'no-store' }),
        fetch(`/api/cx-agents/sales-events?${qs}`, { cache: 'no-store' }),
      ]);
      const rData = (await rRes.json().catch(() => ({}))) as { ratings?: CxAgentRating[] };
      const sData = (await sRes.json().catch(() => ({}))) as { events?: CxSalesEvent[] };
      setRatings(rData.ratings ?? []);
      setEvents(sData.events ?? []);
      setLoading(false);
    }
    void load();
  }, [cxAgentId]);

  const avg =
    ratings.length > 0
      ? (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1)
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel>
        <PanelHeader
          title="Ratings"
          subtitle={avg ? `Average ${avg} / 5 · ${ratings.length} responses` : 'Visitor scores'}
        />
        <PanelBody>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : ratings.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No ratings yet. Visitors are prompted after a helpful exchange when ratings are
              enabled on your plan.
            </p>
          ) : (
            <ul className="space-y-2">
              {ratings.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="success" size="sm">
                      {r.score} / 5
                    </Badge>
                    <span className="font-mono text-[10px] text-zinc-600">
                      {formatDateTime(r.created_at)}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="mt-1 text-xs text-zinc-400">{r.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Sales events" subtitle="Milestones logged by this CX Agent" />
        <PanelBody>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No sales events yet. The agent logs these when it records a real sales milestone.
            </p>
          ) : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-emerald-400/90">{e.event_type}</span>
                    <span className="font-mono text-[10px] text-zinc-600">
                      {formatDateTime(e.created_at)}
                    </span>
                  </div>
                  {e.detail && <p className="mt-1 text-xs text-zinc-400">{e.detail}</p>}
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
