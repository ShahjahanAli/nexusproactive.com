import Link from 'next/link';
import { apiFetch } from '@/lib/server-api';
import type { Action, Site } from '@nexus/shared-types';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody } from '@/components/dashboard/ui/panel';
import { EmptyState } from '@/components/dashboard/ui/empty-state';
import { ActionReviewRow } from '@/components/dashboard/action-review-row';
import { Badge, riskTierBadge } from '@/components/dashboard/ui/badge';

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [actionsData, siteData] = await Promise.all([
    apiFetch<{ actions: Action[] }>(`/sites/${id}/actions`).catch(() => ({ actions: [] })),
    apiFetch<{ site: Site }>(`/sites/${id}`).catch(() => null),
  ]);
  const data = actionsData;
  const site = siteData?.site;

  const reviewed = data.actions.filter((a) => a.reviewed_by_human).length;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code={`action_graph/${id.slice(0, 8)}`}
        title={site?.name ?? 'Action Graph'}
        description={
          site
            ? `${site.domain} · Callable backend operations from OpenAPI spec`
            : 'Callable backend operations discovered from OpenAPI spec. Risk tiers govern autonomous execution policy.'
        }
        action={
          <div className="flex items-center gap-4">
            <Link
              href={`/app/sites/${id}/edit`}
              className="font-mono text-[10px] uppercase tracking-wider text-emerald-500 hover:text-emerald-400"
            >
              Edit deployment
            </Link>
            <Link
              href="/app/sites"
              className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
            >
              ← Deployments
            </Link>
          </div>
        }
      />

      {data.actions.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[
            { label: 'Total actions', value: data.actions.length },
            { label: 'Reviewed', value: reviewed },
            { label: 'Pending', value: data.actions.length - reviewed },
            {
              label: 'Financial',
              value: data.actions.filter((a) => a.risk_tier === 'financial').length,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-4 py-3"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                {stat.label}
              </p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-zinc-100">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {data.actions.length === 0 ? (
        <EmptyState
          title="Graph empty"
          description="No actions ingested. Add or update the OpenAPI spec URL in deployment settings."
          actionLabel="Edit deployment"
          actionHref={`/app/sites/${id}/edit`}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {data.actions.map((action) => (
              <Panel key={action.id}>
                <PanelBody className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-cyan-500/30 bg-cyan-950/40 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-400">
                      {action.method}
                    </span>
                    <Badge variant={riskTierBadge(action.risk_tier)} size="sm">
                      {action.risk_tier.replace(/_/g, ' ')}
                    </Badge>
                    {!action.reviewed_by_human && (
                      <Badge variant="warning" size="sm">
                        Pending review
                      </Badge>
                    )}
                  </div>
                  <p className="break-all font-mono text-xs text-zinc-400">{action.path}</p>
                </PanelBody>
              </Panel>
            ))}
          </div>

          {/* Desktop table */}
          <Panel className="hidden lg:block">
            <PanelBody noPadding>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800/80 bg-zinc-900/40">
                      {['Method', 'Path', 'Risk tier', 'Review', 'Spec ver.'].map((h) => (
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
                    {data.actions.map((action) => (
                      <ActionReviewRow key={action.id} action={action} />
                    ))}
                  </tbody>
                </table>
              </div>
            </PanelBody>
          </Panel>
        </>
      )}
    </div>
  );
}
