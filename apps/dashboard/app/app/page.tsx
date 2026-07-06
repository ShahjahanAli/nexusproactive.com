import Link from 'next/link';
import { getCurrentUser, apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { StatCard } from '@/components/dashboard/ui/stat-card';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { EmptyState } from '@/components/dashboard/ui/empty-state';
import { ButtonLink } from '@/components/dashboard/ui/button';
import { Badge } from '@/components/dashboard/ui/badge';
import type { Site } from '@nexus/shared-types';

export default async function AppHomePage() {
  const user = await getCurrentUser();
  const plan = await apiFetch<{
    plan: string;
    limits: { max_sites: number; max_conversations_month: number; max_tokens_month: number };
    usage: { conversations_count: number; tokens_used: number };
  }>('/tenant/plan').catch(() => null);

  const sitesData = await apiFetch<{ sites: Site[] }>('/sites').catch(() => ({
    sites: [],
  }));
  const siteCount = sitesData.sites.length;

  const convPct = plan
    ? Math.min(
        100,
        Math.round(
          (plan.usage.conversations_count / plan.limits.max_conversations_month) * 100,
        ),
      )
    : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="command_center"
        title="Command Center"
        description={
          user
            ? `Operational overview for ${user.companyName}. Monitor deployments, capacity, and system status.`
            : 'Operational overview and system status.'
        }
        action={
          <ButtonLink href="/app/onboarding" size="sm">
            + Deploy site
          </ButtonLink>
        }
      />

      {plan && (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Active plan"
            value={<span className="capitalize">{plan.plan}</span>}
            sub="Subscription tier"
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
          />
          <StatCard
            label="Deployments"
            value={`${siteCount}/${plan.limits.max_sites}`}
            sub={siteCount >= plan.limits.max_sites ? 'At capacity' : 'Sites online'}
            trend={siteCount >= plan.limits.max_sites ? 'down' : 'neutral'}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            }
          />
          <StatCard
            label="Conversations"
            value={plan.usage.conversations_count.toLocaleString()}
            sub={`${convPct}% of ${plan.limits.max_conversations_month.toLocaleString()} cap`}
            trend={convPct >= 90 ? 'down' : convPct >= 70 ? 'neutral' : 'up'}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
          />
          <StatCard
            label="Token usage"
            value={plan.usage.tokens_used.toLocaleString()}
            sub={`${Math.min(100, Math.round((plan.usage.tokens_used / plan.limits.max_tokens_month) * 100))}% of ${plan.limits.max_tokens_month.toLocaleString()}/mo`}
            trend={
              plan.usage.tokens_used / plan.limits.max_tokens_month >= 0.9
                ? 'down'
                : 'neutral'
            }
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
        <Panel accent className="lg:col-span-3">
          <PanelHeader
            code="deploy_status"
            title="Deployment status"
            subtitle="Connected sites and action graph readiness"
          />
          <PanelBody>
            {siteCount === 0 ? (
              <EmptyState
                title="No deployments"
                description="Connect your first site to ingest OpenAPI capabilities and activate the action graph."
                actionLabel="Initialize deployment"
                actionHref="/app/onboarding"
                icon={
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                }
              />
            ) : (
              <ul className="divide-y divide-zinc-800/80">
                {sitesData.sites.map((site) => (
                  <li key={site.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-zinc-100">{site.name}</p>
                        <Badge variant="success" size="sm" dot>
                          Online
                        </Badge>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-zinc-500">
                        {site.domain} · {site.backend_base_url}
                      </p>
                    </div>
                    <Link
                      href={`/app/sites/${site.id}`}
                      className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-emerald-500 hover:text-emerald-400"
                    >
                      View action graph →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader code="quick_ops" title="Quick ops" />
          <PanelBody className="space-y-2">
            {[
              { href: '/app/onboarding', label: 'Deploy new site', code: 'DEP-01' },
              { href: '/app/sites', label: 'Manage deployments', code: 'DEP-02' },
              { href: '/app/analytics', label: 'View telemetry', code: 'TEL-01' },
              { href: '/app/billing', label: 'Resource allocation', code: 'RES-01' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-3 py-3 transition hover:border-emerald-500/20 hover:bg-emerald-950/20"
              >
                <span className="text-sm text-zinc-300">{item.label}</span>
                <span className="font-mono text-[10px] text-zinc-600">{item.code}</span>
              </Link>
            ))}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
