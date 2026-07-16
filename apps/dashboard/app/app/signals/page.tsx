import { apiFetch } from '@/lib/server-api';
import { buildListQuery, currentPage } from '@/lib/list-params';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { EmptyState } from '@/components/dashboard/ui/empty-state';
import { Badge } from '@/components/dashboard/ui/badge';
import { ListPagination } from '@/components/dashboard/ui/pagination';
import { ListFilters } from '@/components/dashboard/list-filters';
import { SignalSuggestionActions } from '@/components/dashboard/signal-suggestion-actions';
import type { Site } from '@nexus/shared-types';

interface Signal {
  id: string;
  site_name: string;
  cluster_label: string | null;
  representative_message: string;
  occurrence_count: number;
  status: string;
  last_seen: string;
  suggested_endpoint?: Record<string, unknown> | null;
  suggestion_status?: string | null;
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
    apiFetch<{ signals: Signal[]; total: number; limit: number }>(
      `/signals?${qs.toString()}`,
    ).catch(() => ({ signals: [], total: 0, limit: 20 })),
  ]);

  const hasFilters = Boolean(
    params.q?.trim() || params.siteId || params.status || params.minOccurrences,
  );
  const limit = data.limit || 20;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Customer Signals"
        description="Recurring unanswered requests and low-confidence conversations that may highlight product gaps or missing support coverage."
      />

      <Panel>
        <PanelHeader title="Filters" subtitle="Find recurring customer requests and gaps" />
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
                  { value: 'new', label: 'New' },
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
                  { value: '5', label: '5 or more' },
                  { value: '10', label: '10 or more' },
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
              : 'Signals will appear when visitors ask for capabilities your current setup cannot confidently support.'
          }
        />
      ) : (
        <Panel>
          <PanelHeader
            title={`${data.total.toLocaleString()} customer signals`}
            subtitle="Sorted by frequency and recency"
          />
          <PanelBody className="space-y-3 !p-4 sm:!p-5">
            {data.signals.map((s) => (
              <Panel key={s.id} accent={s.occurrence_count >= 5}>
                <PanelBody>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="warning" size="sm">
                          {s.occurrence_count}x reported
                        </Badge>
                        <span className="text-xs text-zinc-500">{s.site_name}</span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-200">{s.representative_message}</p>
                      {s.cluster_label && (
                        <p className="mt-1 text-xs text-zinc-500">Group: {s.cluster_label}</p>
                      )}
                      <SignalSuggestionActions
                        signalId={s.id}
                        suggestion={s.suggested_endpoint}
                        suggestionStatus={s.suggestion_status}
                      />
                    </div>
                    <Badge variant="default" size="sm">
                      {s.status}
                    </Badge>
                  </div>
                </PanelBody>
              </Panel>
            ))}
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
