import Link from 'next/link';
import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/admin/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/admin/ui/panel';
import { Badge } from '@/components/admin/ui/badge';
import { TenantFilters } from '@/components/admin/tenant-filters';

type TenantRow = {
  id: string;
  company_name: string;
  owner_email: string;
  plan: string;
  status: string;
  created_at: string;
  sites_count: string;
  users_count: string;
  conversations_count: string;
  tokens_used: string;
};

function statusVariant(status: string) {
  if (status === 'active') return 'success' as const;
  if (status === 'suspended') return 'danger' as const;
  return 'warning' as const;
}

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string; status?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.plan) qs.set('plan', params.plan);
  if (params.status) qs.set('status', params.status);

  const { tenants, total } = await apiFetch<{ tenants: TenantRow[]; total: number }>(
    `/platform/tenants?${qs.toString()}`,
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="tenant_registry"
        title="Tenants"
        description={`Cross-tenant control — ${total} account${total === 1 ? '' : 's'} on the platform.`}
      />

      <Panel>
        <PanelHeader code="filters" title="Filter registry" />
        <PanelBody>
          <TenantFilters
            initialQ={params.q}
            initialPlan={params.plan}
            initialStatus={params.status}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader code="accounts" title="Accounts" subtitle={`${tenants.length} shown`} />
        <PanelBody noPadding>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800/80 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3 sm:px-5">Company</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sites</th>
                  <th className="px-4 py-3">Usage</th>
                  <th className="px-4 py-3 sm:px-5" />
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-900/80 hover:bg-zinc-900/40">
                    <td className="px-4 py-3 sm:px-5">
                      <p className="font-medium text-zinc-100">{t.company_name}</p>
                      <p className="font-mono text-[10px] text-zinc-500">{t.owner_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="tactical" size="sm">
                        {t.plan}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(t.status)} size="sm">
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {t.sites_count}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {t.conversations_count} conv ·{' '}
                      {(Number(t.tokens_used) / 1_000_000).toFixed(1)}M tok
                    </td>
                    <td className="px-4 py-3 text-right sm:px-5">
                      <Link
                        href={`/admin/tenants/${t.id}`}
                        className="font-mono text-[10px] uppercase tracking-wider text-amber-500 hover:text-amber-400"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-zinc-500">
                      No tenants match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
