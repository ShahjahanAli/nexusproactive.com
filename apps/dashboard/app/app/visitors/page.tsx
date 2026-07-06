import Link from 'next/link';
import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { EmptyState } from '@/components/dashboard/ui/empty-state';
import { Badge } from '@/components/dashboard/ui/badge';

import { formatDateTime } from '@/lib/datetime';

interface VisitorRow {
  visitor_id: string;
  conversations: number;
  messages: number;
  tokens_used: number;
  sites: string[];
  first_seen: string;
  last_seen: string;
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatWhen(iso: string) {
  return formatDateTime(iso);
}

export default async function VisitorsPage() {
  const data = await apiFetch<{ visitors: VisitorRow[] }>('/visitors').catch(() => ({
    visitors: [],
  }));

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="visitors"
        title="Visitors"
        description="Unique visitors across all deployments — anonymous browser IDs or logged-in IDs from your site."
      />

      {data.visitors.length === 0 ? (
        <EmptyState
          title="No visitors yet"
          description="Visitors appear when someone uses the embedded chat widget."
        />
      ) : (
        <Panel>
          <PanelHeader
            code="visitor_registry"
            title={`${data.visitors.length} unique visitors`}
            subtitle="Sorted by most recent activity"
          />
          <PanelBody noPadding>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/80 bg-zinc-900/40">
                    {['Visitor ID', 'Sites', 'Chats', 'Tokens', 'Last seen', ''].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 font-mono text-[10px] font-normal uppercase tracking-wider text-zinc-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.visitors.map((v) => (
                    <tr
                      key={v.visitor_id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-900/30"
                    >
                      <td className="px-5 py-4">
                        <p className="font-mono text-xs text-zinc-300">
                          {v.visitor_id.slice(0, 12)}…
                        </p>
                        <p className="font-mono text-[10px] text-zinc-600">
                          since {formatWhen(v.first_seen)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(v.sites ?? []).slice(0, 2).map((s) => (
                            <Badge key={s} variant="default" size="sm">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs tabular-nums text-zinc-400">
                        {v.conversations} / {v.messages} msgs
                      </td>
                      <td className="px-5 py-4 font-mono text-xs tabular-nums text-emerald-400/90">
                        {formatTokens(v.tokens_used)}
                      </td>
                      <td className="px-5 py-4 font-mono text-[10px] text-zinc-500">
                        {formatWhen(v.last_seen)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/app/visitors/${encodeURIComponent(v.visitor_id)}`}
                          className="font-mono text-[10px] uppercase tracking-wider text-emerald-500 hover:text-emerald-400"
                        >
                          Profile →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
