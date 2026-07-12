import Link from 'next/link';
import type { PlatformOverviewStats } from '@nexus/shared-types';
import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/admin/ui/page-header';
import { StatCard } from '@/components/admin/ui/stat-card';
import { Panel, PanelBody, PanelHeader } from '@/components/admin/ui/panel';
import { Badge } from '@/components/admin/ui/badge';
import { ButtonLink } from '@/components/admin/ui/button';

export default async function OverviewPage() {
  const { stats } = await apiFetch<{ stats: PlatformOverviewStats }>('/platform/overview');

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="platform_overview"
        title="Control plane"
        description="Global tenant health, subscription mix, and platform capacity."
        action={<ButtonLink href="/admin/tenants">Manage tenants</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tenants" value={stats.tenants_total} sub={`${stats.tenants_active} active`} />
        <StatCard label="Suspended" value={stats.tenants_suspended} />
        <StatCard label="Sites" value={stats.sites_total} />
        <StatCard
          label="Convos / month"
          value={stats.conversations_month.toLocaleString()}
          sub={`${(stats.tokens_month / 1_000_000).toFixed(1)}M tokens`}
        />
      </div>

      <Panel accent>
        <PanelHeader code="plan_mix" title="Subscription mix" subtitle="Tenant count by plan" />
        <PanelBody>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(stats.by_plan) as Array<keyof typeof stats.by_plan>).map((plan) => (
              <div
                key={plan}
                className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="tactical" size="sm">
                    {plan}
                  </Badge>
                  <span className="font-mono text-xl font-bold text-zinc-100">
                    {stats.by_plan[plan]}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admin/plans"
              className="font-mono text-[10px] uppercase tracking-wider text-amber-500 hover:text-amber-400"
            >
              Edit plan catalog →
            </Link>
            <Link
              href="/admin/features"
              className="font-mono text-[10px] uppercase tracking-wider text-amber-500 hover:text-amber-400"
            >
              Feature flags →
            </Link>
            <Link
              href="/admin/settings"
              className="font-mono text-[10px] uppercase tracking-wider text-amber-500 hover:text-amber-400"
            >
              Global settings →
            </Link>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
