'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { Badge } from '@/components/dashboard/ui/badge';
import { Button } from '@/components/dashboard/ui/button';

type Period = 'today' | '7d' | '30d';

interface LeaderboardRow {
  cx_agent_id: string;
  name: string;
  display_name: string;
  status: string;
  chats_handled: number;
  active_chats: number;
  avg_rating: number | null;
  rating_count: number;
  sales_events: number;
  specialist_consults: number;
  human_escalations: number;
}

interface Leaderboard {
  period: Period;
  generated_at: string;
  enabled: boolean;
  rows: LeaderboardRow[];
}

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
];

export function CxLeaderboardView() {
  const [period, setPeriod] = useState<Period>('7d');
  const [data, setData] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<keyof LeaderboardRow>('chats_handled');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/cx-agents/leaderboard?period=${period}`, {
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => ({}))) as {
        leaderboard?: Leaderboard;
        error?: string;
      };
      setLoading(false);
      if (!res.ok) {
        setError(json.error ?? 'Failed to load leaderboard');
        return;
      }
      setData(json.leaderboard ?? null);
      setError(null);
    }
    void load();
  }, [period]);

  const rows = [...(data?.rows ?? [])].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'number' && typeof bv === 'number') return bv - av;
    if (av == null) return 1;
    if (bv == null) return -1;
    return String(bv).localeCompare(String(av));
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-zinc-500">
          Compare CX Agents by chats handled, ratings, sales events, specialist consults, and
          human escalations.
        </p>
        <div className="flex gap-1 rounded-lg border border-zinc-800 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`rounded-md px-3 py-1.5 text-xs ${
                period === p.id
                  ? 'bg-zinc-100 font-medium text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && !data ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : data && !data.enabled ? (
        <Panel>
          <PanelBody>
            <p className="text-sm text-amber-200">
              Leaderboard is disabled on your plan. Enable{' '}
              <span className="font-mono text-xs">cx_leaderboard_enabled</span> in Admin → Plans.
            </p>
          </PanelBody>
        </Panel>
      ) : (
        <Panel>
          <PanelHeader
            title="CX Agent leaderboard"
            subtitle={
              data?.generated_at
                ? `As of ${new Date(data.generated_at).toLocaleString()}`
                : undefined
            }
          />
          <PanelBody className="overflow-x-auto">
            {rows.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No CX Agents yet. Create one to start tracking performance.
              </p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    {(
                      [
                        ['display_name', 'Agent'],
                        ['chats_handled', 'Chats'],
                        ['active_chats', 'Live'],
                        ['avg_rating', 'Rating'],
                        ['sales_events', 'Sales'],
                        ['specialist_consults', 'Consults'],
                        ['human_escalations', 'Escalations'],
                      ] as const
                    ).map(([key, label]) => (
                      <th key={key} className="px-2 py-2 font-normal">
                        <button
                          type="button"
                          className="hover:text-zinc-300"
                          onClick={() => setSortKey(key)}
                        >
                          {label}
                          {sortKey === key ? ' ↓' : ''}
                        </button>
                      </th>
                    ))}
                    <th className="px-2 py-2 font-normal"> </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.cx_agent_id}
                      className="border-b border-zinc-800/60 text-zinc-300"
                    >
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-zinc-600">
                            #{i + 1}
                          </span>
                          <div>
                            <p className="font-medium text-zinc-100">{row.display_name}</p>
                            <p className="font-mono text-[10px] text-zinc-600">{row.name}</p>
                          </div>
                          <Badge
                            variant={row.status === 'active' ? 'success' : 'default'}
                            size="sm"
                          >
                            {row.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-2 py-3 font-mono text-xs">{row.chats_handled}</td>
                      <td className="px-2 py-3 font-mono text-xs">{row.active_chats}</td>
                      <td className="px-2 py-3 font-mono text-xs">
                        {row.avg_rating != null
                          ? `${row.avg_rating} (${row.rating_count})`
                          : '—'}
                      </td>
                      <td className="px-2 py-3 font-mono text-xs">{row.sales_events}</td>
                      <td className="px-2 py-3 font-mono text-xs">
                        {row.specialist_consults}
                      </td>
                      <td className="px-2 py-3 font-mono text-xs">
                        {row.human_escalations}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Link href={`/app/cx-agents/${row.cx_agent_id}`}>
                          <Button variant="secondary" size="sm">
                            Open
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
