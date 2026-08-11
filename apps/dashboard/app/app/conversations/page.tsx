import Link from 'next/link';
import { apiFetch } from '@/lib/server-api';
import { buildListQuery, currentPage } from '@/lib/list-params';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { EmptyState } from '@/components/dashboard/ui/empty-state';
import { Badge } from '@/components/dashboard/ui/badge';
import { StatCard } from '@/components/dashboard/ui/stat-card';
import { ListPagination } from '@/components/dashboard/ui/pagination';
import { ListFilters } from '@/components/dashboard/list-filters';
import { LanguageTag } from '@/components/dashboard/ui/language-tag';
import { formatDateTime, formatDuration, formatRelative, getTimezoneLabel } from '@/lib/datetime';
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
  last_message_at: string | null;
  detected_language: string | null;
  escalated_at: string | null;
  cx_agent_name: string | null;
  assigned_agent: string | null;
  rating_score: number | null;
  preview: string | null;
}

interface ConversationStats {
  total: number;
  open: number;
  escalated: number;
  human: number;
  closed: number;
  messages: number;
  tokens: number;
  today: number;
  avg_messages: number;
  avg_rating: number | null;
  rated: number;
}

const EMPTY_STATS: ConversationStats = {
  total: 0,
  open: 0,
  escalated: 0,
  human: 0,
  closed: 0,
  messages: 0,
  tokens: 0,
  today: 0,
  avg_messages: 0,
  avg_rating: null,
  rated: 0,
};

const statusVariant: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
  open: 'success',
  escalated: 'warning',
  human: 'info',
  closed: 'default',
};

const statusLabel: Record<string, string> = {
  open: 'AI handling',
  escalated: 'Waiting for human',
  human: 'Human agent live',
  closed: 'Closed',
};

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
    apiFetch<{
      conversations: ConversationRow[];
      total: number;
      limit: number;
      stats?: ConversationStats;
    }>(`/conversations?${qs.toString()}`).catch(() => ({
      conversations: [],
      total: 0,
      limit: 20,
      stats: EMPTY_STATS,
    })),
  ]);

  const hasFilters = Boolean(
    params.q?.trim() || params.siteId || params.status || params.activeAgent,
  );
  const limit = data.limit || 20;
  const stats = data.stats ?? EMPTY_STATS;
  const liveNow = stats.open + stats.escalated + stats.human;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Conversations"
        description={`Review visitor conversations across all connected sites. Times shown in ${getTimezoneLabel()}.`}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={hasFilters ? 'Matching threads' : 'Total threads'}
          value={stats.total.toLocaleString()}
          sub={`${stats.today.toLocaleString()} started today`}
        />
        <StatCard
          label="Active now"
          value={liveNow.toLocaleString()}
          sub={`${stats.open} AI · ${stats.escalated} waiting · ${stats.human} human`}
          trend={stats.escalated > 0 ? 'down' : 'neutral'}
        />
        <StatCard
          label="Messages"
          value={stats.messages.toLocaleString()}
          sub={`${stats.avg_messages} avg per thread`}
        />
        <StatCard
          label="Avg rating"
          value={stats.avg_rating !== null ? `${stats.avg_rating}/5` : '—'}
          sub={
            stats.rated > 0
              ? `${stats.rated.toLocaleString()} rated · ${stats.tokens.toLocaleString()} tokens`
              : `No ratings yet · ${stats.tokens.toLocaleString()} tokens`
          }
        />
      </div>

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
            subtitle="Most recently active first"
          />
          <PanelBody className="space-y-3 !p-4 sm:!p-5">
            {data.conversations.map((c) => {
              const lastAt = c.last_message_at ?? c.created_at;
              return (
                <Panel key={c.id}>
                  <PanelBody className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-zinc-100">{c.site_name}</p>
                        <Badge
                          variant={statusVariant[c.status] ?? 'default'}
                          size="sm"
                          dot={c.status === 'human' || c.status === 'escalated'}
                        >
                          {statusLabel[c.status] ?? c.status}
                        </Badge>
                        {c.cx_agent_name ? (
                          <Badge variant="tactical" size="sm">
                            CX · {c.cx_agent_name}
                          </Badge>
                        ) : (
                          <Badge variant="tactical" size="sm">
                            {c.active_agent}
                          </Badge>
                        )}
                        {c.assigned_agent && (
                          <Badge variant="info" size="sm">
                            {c.assigned_agent}
                          </Badge>
                        )}
                        <LanguageTag code={c.detected_language} size="sm" />
                        {typeof c.rating_score === 'number' && (
                          <Badge variant="success" size="sm">
                            {c.rating_score}/5
                          </Badge>
                        )}
                      </div>

                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        {c.preview?.trim()
                          ? `“${c.preview.trim().slice(0, 140)}${
                              c.preview.trim().length > 140 ? '…' : ''
                            }”`
                          : 'No visitor message yet.'}
                      </p>

                      <p className="mt-2 text-xs text-zinc-500">
                        <span className="text-zinc-400">{formatDateTime(c.created_at)}</span>
                        {' · last activity '}
                        {formatRelative(lastAt)}
                        {' · '}
                        {formatDuration(c.created_at, lastAt)} long
                      </p>
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
                      className="shrink-0 text-sm font-medium text-emerald-500 hover:text-emerald-400"
                    >
                      Open →
                    </Link>
                  </PanelBody>
                </Panel>
              );
            })}
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
