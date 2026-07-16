import Link from 'next/link';
import { apiFetch } from '@/lib/server-api';
import { buildListQuery, currentPage } from '@/lib/list-params';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { EmptyState } from '@/components/dashboard/ui/empty-state';
import { Badge } from '@/components/dashboard/ui/badge';
import { ListPagination } from '@/components/dashboard/ui/pagination';
import { ListFilters } from '@/components/dashboard/list-filters';
import { formatDateTime } from '@/lib/datetime';
import type { Site } from '@nexus/shared-types';

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

export default async function VisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; siteId?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = currentPage(params);
  const qs = buildListQuery(params, ['q', 'siteId']);
  if (page > 1) qs.set('page', String(page));

  const [sitesData, data] = await Promise.all([
    apiFetch<{ sites: Site[] }>('/sites').catch(() => ({ sites: [] })),
    apiFetch<{ visitors: VisitorRow[]; total: number; limit: number }>(
      `/visitors?${qs.toString()}`,
    ).catch(() => ({ visitors: [], total: 0, limit: 20 })),
  ]);

  const hasFilters = Boolean(params.q?.trim() || params.siteId);
  const limit = data.limit || 20;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Visitors"
        description="See who is interacting with your chat experience across all connected sites, including anonymous and identified visitors."
      />

      <Panel>
        <PanelHeader title="Filters" subtitle="Search by visitor ID or narrow by site" />
        <PanelBody>
          <ListFilters
            basePath="/app/visitors"
            initialValues={params}
            searchPlaceholder="Search visitor ID"
            sites={sitesData.sites.map((s) => ({ id: s.id, name: s.name }))}
          />
        </PanelBody>
      </Panel>

      {data.visitors.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No visitors match your filters' : 'No visitors yet'}
          description={
            hasFilters
              ? 'Try clearing filters or broadening your search.'
              : 'Visitors appear when someone uses the embedded chat widget.'
          }
        />
      ) : (
        <Panel>
          <PanelHeader
            title={`${data.total.toLocaleString()} unique visitors`}
            subtitle="Sorted by most recent chat activity"
          />
          <PanelBody noPadding>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/80 bg-zinc-900/40">
                    {['Visitor', 'Sites', 'Activity', 'Tokens', 'Last seen', ''].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-medium text-zinc-500"
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
                        <p className="font-mono text-xs text-zinc-200">
                          {v.visitor_id.slice(0, 12)}…
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          First seen {formatDateTime(v.first_seen)}
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
                      <td className="px-5 py-4 text-sm tabular-nums text-zinc-400">
                        {v.conversations} chats · {v.messages} messages
                      </td>
                      <td className="px-5 py-4 text-sm tabular-nums font-medium text-emerald-500">
                        {formatTokens(v.tokens_used)}
                      </td>
                      <td className="px-5 py-4 text-xs text-zinc-500">
                        {formatDateTime(v.last_seen)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/app/visitors/${encodeURIComponent(v.visitor_id)}`}
                          className="text-sm font-medium text-emerald-500 hover:text-emerald-400"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListPagination
              total={data.total}
              limit={limit}
              page={page}
              basePath="/app/visitors"
              params={params}
            />
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
