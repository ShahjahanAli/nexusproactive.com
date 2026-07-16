import Link from 'next/link';
import { apiFetch } from '@/lib/server-api';
import { buildListQuery, currentPage } from '@/lib/list-params';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { EmptyState } from '@/components/dashboard/ui/empty-state';
import { Badge } from '@/components/dashboard/ui/badge';
import { ListPagination } from '@/components/dashboard/ui/pagination';
import { ListFilters } from '@/components/dashboard/list-filters';
import type { Site } from '@nexus/shared-types';

interface ConversationRow {
  id: string;
  site_name: string;
  visitor_id: string;
  status: string;
  active_agent: string;
  message_count: number;
  tokens_used: number;
  created_at: string;
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    siteId?: string;
    status?: string;
    activeAgent?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = currentPage(params);
  const qs = buildListQuery(params, ['q', 'siteId', 'status', 'activeAgent']);
  if (page > 1) qs.set('page', String(page));

  const [sitesData, data] = await Promise.all([
    apiFetch<{ sites: Site[] }>('/sites').catch(() => ({ sites: [] })),
    apiFetch<{ conversations: ConversationRow[]; total: number; limit: number }>(
      `/conversations?${qs.toString()}`,
    ).catch(() => ({ conversations: [], total: 0, limit: 20 })),
  ]);

  const hasFilters = Boolean(
    params.q?.trim() || params.siteId || params.status || params.activeAgent,
  );
  const limit = data.limit || 20;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Conversations"
        description="Review visitor conversations across all connected sites."
      />

      <Panel>
        <PanelHeader title="Filters" subtitle="Search and narrow the conversation list" />
        <PanelBody>
          <ListFilters
            basePath="/app/conversations"
            initialValues={params}
            searchPlaceholder="Search visitor ID"
            sites={sitesData.sites.map((s) => ({ id: s.id, name: s.name }))}
            selects={[
              {
                name: 'status',
                label: 'Status',
                options: [
                  { value: '', label: 'All statuses' },
                  { value: 'open', label: 'Open (AI)' },
                  { value: 'escalated', label: 'Escalated' },
                  { value: 'human', label: 'Human agent' },
                  { value: 'closed', label: 'Closed' },
                ],
              },
              {
                name: 'activeAgent',
                label: 'Specialist',
                options: [
                  { value: '', label: 'All specialists' },
                  { value: 'orchestrator', label: 'General' },
                  { value: 'billing', label: 'Billing' },
                  { value: 'technical', label: 'Technical' },
                  { value: 'sales', label: 'Sales' },
                  { value: 'account', label: 'Account' },
                ],
              },
            ]}
          />
        </PanelBody>
      </Panel>

      {data.conversations.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No conversations match your filters' : 'No conversations yet'}
          description={
            hasFilters
              ? 'Try clearing filters or broadening your search.'
              : 'Visitor conversations will appear here once people start using the chat widget on your site.'
          }
        />
      ) : (
        <Panel>
          <PanelHeader
            title={`${data.total.toLocaleString()} conversations`}
            subtitle="Most recent first"
          />
          <PanelBody className="space-y-3 !p-4 sm:!p-5">
            {data.conversations.map((c) => (
              <Panel key={c.id}>
                <PanelBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-zinc-100">{c.site_name}</p>
                      <Badge variant="tactical" size="sm">
                        {c.active_agent}
                      </Badge>
                      <Badge variant="default" size="sm">
                        {c.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {c.message_count} messages · {c.tokens_used.toLocaleString()} tokens ·{' '}
                      <Link
                        href={`/app/visitors/${encodeURIComponent(c.visitor_id)}`}
                        className="text-emerald-500 hover:text-emerald-400"
                      >
                        visitor {c.visitor_id.slice(0, 8)}…
                      </Link>
                    </p>
                  </div>
                  <Link
                    href={`/app/conversations/${c.id}`}
                    className="text-sm font-medium text-emerald-500 hover:text-emerald-400"
                  >
                    Open →
                  </Link>
                </PanelBody>
              </Panel>
            ))}
            <ListPagination
              total={data.total}
              limit={limit}
              page={page}
              basePath="/app/conversations"
              params={params}
            />
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
