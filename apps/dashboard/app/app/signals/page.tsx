import { apiFetch } from '@/lib/server-api';
import { buildListQuery, currentPage } from '@/lib/list-params';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { EmptyState } from '@/components/dashboard/ui/empty-state';
import { Badge } from '@/components/dashboard/ui/badge';
import { StatCard } from '@/components/dashboard/ui/stat-card';
import { ListPagination } from '@/components/dashboard/ui/pagination';
import { ListFilters } from '@/components/dashboard/list-filters';
import { SignalSuggestionActions } from '@/components/dashboard/signal-suggestion-actions';
import { formatDateTime, formatRelative, getTimezoneLabel } from '@/lib/datetime';
import type { Site } from '@nexus/shared-types';

interface Signal {
  id: string;
  site_name: string;
  cluster_label: string | null;
  representative_message: string;
  occurrence_count: number;
  status: string;
  first_seen: string;
  last_seen: string;
  suggested_endpoint?: Record<string, unknown> | null;
  suggestion_status?: string | null;
}

interface SignalStats {
  total: number;
  new_count: number;
  reviewed: number;
  resolved: number;
  hot: number;
  occurrences: number;
  with_suggestion: number;
  sites: number;
  last_7_days: number;
}

const EMPTY_STATS: SignalStats = {
  total: 0,
  new_count: 0,
  reviewed: 0,
  resolved: 0,
  hot: 0,
  occurrences: 0,
  with_suggestion: 0,
  sites: 0,
  last_7_days: 0,
};

const statusVariant: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  new: 'warning',
  reviewed: 'info',
  resolved: 'success',
};

const statusLabel: Record<string, string> = {
  new: 'Needs attention',
  reviewed: 'Reviewed',
  resolved: 'Resolved',
};

function frequencyBadge(count: number): {
  label: string;
  variant: 'danger' | 'warning' | 'info' | 'default';
} {
  if (count >= 10) return { label: `${count}× hot`, variant: 'danger' };
  if (count >= 5) return { label: `${count}× frequent`, variant: 'warning' };
  if (count >= 2) return { label: `${count}× reported`, variant: 'info' };
  return { label: '1× reported', variant: 'default' };
}

function clusterLabel(raw: string | null): string | null {
  if (!raw) return null;
  if (raw === 'unresolved_intent') return 'Unresolved customer request';
  return raw;
}

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    siteId?: string;
    status?: string;
    minOccurrences?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = currentPage(params);
  const qs = buildListQuery(params, ['q', 'siteId', 'status', 'minOccurrences']);
  if (page > 1) qs.set('page', String(page));

  const [sitesData, data] = await Promise.all([
    apiFetch<{ sites: Site[] }>('/sites').catch(() => ({ sites: [] })),
    apiFetch<{
      signals: Signal[];
      total: number;
      limit: number;
      stats?: SignalStats;
    }>(`/signals?${qs.toString()}`).catch(() => ({
      signals: [],
      total: 0,
      limit: 20,
      stats: EMPTY_STATS,
    })),
  ]);

  const hasFilters = Boolean(
    params.q?.trim() || params.siteId || params.status || params.minOccurrences,
  );
  const limit = data.limit || 20;
  const stats = data.stats ?? EMPTY_STATS;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Customer Signals"
        description={`Recurring unanswered requests that may highlight product gaps or missing API coverage. Times shown in ${getTimezoneLabel()}.`}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={hasFilters ? 'Matching signals' : 'Open gaps'}
          value={stats.total.toLocaleString()}
          sub={`${stats.last_7_days.toLocaleString()} active in last 7 days`}
        />
        <StatCard
          label="Needs attention"
          value={stats.new_count.toLocaleString()}
          sub={`${stats.hot.toLocaleString()} hot (≥5 reports)`}
          trend={stats.hot > 0 ? 'down' : 'neutral'}
        />
        <StatCard
          label="Total reports"
          value={stats.occurrences.toLocaleString()}
          sub={`Across ${stats.sites.toLocaleString()} site${stats.sites === 1 ? '' : 's'}`}
        />
        <StatCard
          label="API stubs"
          value={stats.with_suggestion.toLocaleString()}
          sub={`${stats.reviewed.toLocaleString()} reviewed · ${stats.resolved.toLocaleString()} resolved`}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Filters"
          subtitle="Find recurring requests, hot clusters, and unresolved gaps"
        />
        <PanelBody>
          <ListFilters
            basePath="/app/signals"
            initialValues={params}
            searchPlaceholder="Search message text"
            sites={sitesData.sites.map((s) => ({ id: s.id, name: s.name }))}
            selects={[
              {
                name: 'status',
                label: 'Status',
                options: [
                  { value: '', label: 'All statuses' },
                  { value: 'new', label: 'Needs attention' },
                  { value: 'reviewed', label: 'Reviewed' },
                  { value: 'resolved', label: 'Resolved' },
                ],
              },
              {
                name: 'minOccurrences',
                label: 'Min. reports',
                options: [
                  { value: '', label: 'Any count' },
                  { value: '2', label: '2 or more' },
                  { value: '5', label: '5 or more (frequent)' },
                  { value: '10', label: '10 or more (hot)' },
                ],
              },
            ]}
          />
        </PanelBody>
      </Panel>

      {data.signals.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No signals match your filters' : 'No customer signals yet'}
          description={
            hasFilters
              ? 'Try clearing filters or broadening your search.'
              : 'Signals appear when visitors ask for capabilities your connected APIs cannot confidently support.'
          }
        />
      ) : (
        <Panel>
          <PanelHeader
            title={`${data.total.toLocaleString()} customer signals`}
            subtitle="Sorted by frequency, then most recently seen"
          />
          <PanelBody className="space-y-3 !p-4 sm:!p-5">
            {data.signals.map((s) => {
              const freq = frequencyBadge(s.occurrence_count);
              const group = clusterLabel(s.cluster_label);
              return (
                <Panel key={s.id} accent={s.occurrence_count >= 5 && s.status === 'new'}>
                  <PanelBody>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={freq.variant} size="sm" dot={s.occurrence_count >= 5}>
                            {freq.label}
                          </Badge>
                          <Badge variant={statusVariant[s.status] ?? 'default'} size="sm">
                            {statusLabel[s.status] ?? s.status}
                          </Badge>
                          <span className="text-xs font-medium text-zinc-400">{s.site_name}</span>
                          {group && (
                            <Badge variant="tactical" size="sm">
                              {group}
                            </Badge>
                          )}
                        </div>

                        <p className="mt-3 text-sm leading-6 text-zinc-200">
                          “{s.representative_message}”
                        </p>

                        <p className="mt-2 text-xs text-zinc-500">
                          First seen{' '}
                          <span className="text-zinc-400">{formatDateTime(s.first_seen)}</span>
                          {' · last seen '}
                          {formatRelative(s.last_seen)}
                          {' · '}
                          <span className="text-zinc-400">{formatDateTime(s.last_seen)}</span>
                        </p>

                        <SignalSuggestionActions
                          signalId={s.id}
                          suggestion={s.suggested_endpoint}
                          suggestionStatus={s.suggestion_status}
                          signalStatus={s.status}
                        />
                      </div>
                    </div>
                  </PanelBody>
                </Panel>
              );
            })}
            <ListPagination
              total={data.total}
              limit={limit}
              page={page}
              basePath="/app/signals"
              params={params}
            />
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
