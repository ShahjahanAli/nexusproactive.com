import Link from 'next/link';
import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { StatCard } from '@/components/dashboard/ui/stat-card';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { ProgressBar } from '@/components/dashboard/ui/progress-bar';
import { Badge } from '@/components/dashboard/ui/badge';

interface Analytics {
  period: { start: string; label: string };
  usage: {
    conversations_count: number;
    tokens_used: number;
    max_conversations_month: number;
    max_tokens_month: number;
  };
  today: { conversations: number; tokens: number };
  visitors: {
    unique_total: number;
    unique_this_month: number;
    unique_today: number;
    active_now: number;
  };
  totals: {
    sites: number;
    conversations: number;
    messages: number;
    action_executions: number;
    active_actions: number;
    product_signals: number;
    open_conversations: number;
  };
  averages: { messages_per_conversation: number; tokens_per_conversation: number };
  bySite: Array<{
    site_id: string;
    site_name: string;
    domain: string;
    conversations: number;
    messages: number;
    tokens_used: number;
    unique_visitors: number;
  }>;
  dailyUsage: Array<{ date: string; conversations: number; tokens: number }>;
  recentConversations: Array<{
    id: string;
    site_name: string;
    visitor_id: string;
    active_agent: string;
    message_count: number;
    tokens_used: number;
    created_at: string;
  }>;
  recentExecutions: Array<{
    id: string;
    site_name: string;
    operation_id: string;
    method: string;
    path: string;
    status: string;
    executed_at: string | null;
  }>;
}

function pct(current: number, limit: number) {
  return limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default async function AnalyticsPage() {
  const data = await apiFetch<Analytics>('/tenant/analytics').catch(() => null);

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader code="telemetry" title="Telemetry" description="Unable to load analytics." />
      </div>
    );
  }

  const convPct = pct(data.usage.conversations_count, data.usage.max_conversations_month);
  const tokenPct = pct(data.usage.tokens_used, data.usage.max_tokens_month);
  const maxDailyTokens = Math.max(...data.dailyUsage.map((d) => d.tokens), 1);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="telemetry"
        title="Telemetry"
        description={`Usage and activity for ${data.period.label}. Token consumption, visitors, API actions, and conversation metrics.`}
        action={
          <Link href="/app/visitors" className="font-mono text-[10px] uppercase tracking-wider text-emerald-500">
            Visitors →
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Active now"
          value={data.visitors.active_now}
          sub="Visitors with activity in last 15 min"
          trend={data.visitors.active_now > 0 ? 'up' : 'neutral'}
        />
        <StatCard
          label="Unique today"
          value={data.visitors.unique_today}
          sub={`${data.visitors.unique_this_month} this month`}
        />
        <StatCard
          label="Unique total"
          value={data.visitors.unique_total}
          sub="All-time distinct visitors"
        />
        <StatCard
          label="Tokens this month"
          value={formatTokens(data.usage.tokens_used)}
          sub={`${tokenPct}% of ${formatTokens(data.usage.max_tokens_month)} cap · today ${formatTokens(data.today.tokens)}`}
          trend={tokenPct >= 90 ? 'down' : tokenPct >= 70 ? 'neutral' : 'up'}
        />
        <StatCard
          label="Conversations"
          value={data.usage.conversations_count.toLocaleString()}
          sub={`${convPct}% of cap · ${data.today.conversations} today`}
          trend={convPct >= 90 ? 'down' : 'neutral'}
        />
        <StatCard
          label="Avg tokens / chat"
          value={data.averages.tokens_per_conversation.toLocaleString()}
          sub={`${data.averages.messages_per_conversation} msgs avg per conversation`}
        />
        <StatCard
          label="API actions"
          value={data.totals.action_executions.toLocaleString()}
          sub={`${data.totals.active_actions} active endpoints in graph`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
        <Panel accent className="lg:col-span-3">
          <PanelHeader
            code="capacity"
            title="Monthly capacity"
            subtitle="Token and conversation limits for your plan"
          />
          <PanelBody className="space-y-6">
            <ProgressBar
              label="Token allocation"
              current={data.usage.tokens_used}
              limit={data.usage.max_tokens_month}
              pct={tokenPct}
            />
            <ProgressBar
              label="Conversations"
              current={data.usage.conversations_count}
              limit={data.usage.max_conversations_month}
              pct={convPct}
            />
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader code="daily_tokens" title="7-day activity" subtitle="Tokens per day" />
          <PanelBody>
            <div className="flex h-32 items-end justify-between gap-1.5">
              {data.dailyUsage.map((day) => {
                const height = Math.max(4, Math.round((day.tokens / maxDailyTokens) * 100));
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                    <span className="font-mono text-[9px] tabular-nums text-zinc-600">
                      {day.tokens > 0 ? formatTokens(day.tokens) : '—'}
                    </span>
                    <div
                      className="w-full rounded-t bg-emerald-500/70 transition-all"
                      style={{ height: `${height}%`, minHeight: day.tokens > 0 ? 4 : 2 }}
                      title={`${day.conversations} conversations`}
                    />
                    <span className="font-mono text-[8px] text-zinc-600">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Panel>
          <PanelHeader code="system_totals" title="System totals" />
          <PanelBody>
            <dl className="grid grid-cols-2 gap-4">
              {[
                { label: 'Deployments', value: data.totals.sites },
                { label: 'All conversations', value: data.totals.conversations },
                { label: 'Total messages', value: data.totals.messages },
                { label: 'Open chats', value: data.totals.open_conversations },
                { label: 'Product signals', value: data.totals.product_signals },
                { label: 'Active API tools', value: data.totals.active_actions },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                    {item.label}
                  </dt>
                  <dd className="mt-1 font-mono text-xl font-bold tabular-nums text-zinc-100">
                    {item.value.toLocaleString()}
                  </dd>
                </div>
              ))}
            </dl>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader code="by_site" title="Usage by deployment" />
          <PanelBody noPadding>
            {data.bySite.length === 0 ? (
              <p className="px-5 py-4 text-sm text-zinc-500">No deployments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800/80 bg-zinc-900/40">
                      {['Site', 'Visitors', 'Chats', 'Tokens', 'Msgs'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2 font-mono text-[10px] font-normal uppercase tracking-wider text-zinc-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.bySite.map((site) => (
                      <tr key={site.site_id} className="border-b border-zinc-800/40">
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-200">{site.site_name}</p>
                          <p className="font-mono text-[10px] text-zinc-600">{site.domain}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs tabular-nums text-zinc-400">
                          {site.unique_visitors}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs tabular-nums text-zinc-400">
                          {site.conversations}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs tabular-nums text-emerald-400/90">
                          {formatTokens(site.tokens_used)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs tabular-nums text-zinc-500">
                          {site.messages}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Panel>
          <PanelHeader
            code="recent_chats"
            title="Recent conversations"
            action={
              <Link href="/app/conversations" className="font-mono text-[10px] text-emerald-500">
                View all →
              </Link>
            }
          />
          <PanelBody className="space-y-2">
            {data.recentConversations.map((c) => (
              <Link
                key={c.id}
                href={`/app/conversations/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-800/60 px-3 py-2.5 transition hover:border-emerald-500/20 hover:bg-zinc-900/40"
              >
                <div>
                  <p className="text-sm text-zinc-200">{c.site_name}</p>
                  <p className="font-mono text-[10px] text-zinc-600">
                    {c.message_count} msgs · {c.active_agent}
                  </p>
                </div>
                <Badge variant="tactical" size="sm">
                  {formatTokens(c.tokens_used)} tok
                </Badge>
              </Link>
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader code="api_activity" title="Recent API actions" subtitle="Backend calls via chat" />
          <PanelBody className="space-y-2">
            {data.recentExecutions.length === 0 ? (
              <p className="text-sm text-zinc-500">No API actions executed yet.</p>
            ) : (
              data.recentExecutions.map((ex) => (
                <div
                  key={ex.id}
                  className="rounded-lg border border-zinc-800/60 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-cyan-500/30 bg-cyan-950/40 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-400">
                      {ex.method}
                    </span>
                    <Badge
                      variant={
                        ex.status === 'executed'
                          ? 'success'
                          : ex.status === 'pending_approval'
                            ? 'warning'
                            : 'default'
                      }
                      size="sm"
                    >
                      {ex.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-zinc-500">{ex.path}</p>
                  <p className="font-mono text-[10px] text-zinc-600">
                    {ex.site_name} · {ex.operation_id}
                  </p>
                </div>
              ))
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
