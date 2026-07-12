import Link from 'next/link';
import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/admin/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/admin/ui/panel';
import { Badge } from '@/components/admin/ui/badge';
import { TenantEditForm } from '@/components/admin/tenant-edit-form';
import type { Plan, PlanLimits, TenantStatus, TenantUser } from '@nexus/shared-types';

type TenantDetail = {
  tenant: {
    id: string;
    company_name: string;
    owner_email: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    plan: Plan;
    plan_limits: PlanLimits;
    status: TenantStatus;
    notes: string | null;
    created_at: string;
    sites_count: string;
    users_count: string;
    conversations_count: string;
    tokens_used: string;
  };
  users: TenantUser[];
  sites: { id: string; name: string; domain: string; created_at: string }[];
  feature_overrides: { feature_key: string; enabled: boolean }[];
};

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await apiFetch<TenantDetail>(`/platform/tenants/${id}`);
  const { tenant } = detail;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="tenant_detail"
        title={tenant.company_name}
        description={tenant.owner_email}
        action={
          <Link
            href="/admin/tenants"
            className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
          >
            ← Back to registry
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="tactical" size="sm">
          {tenant.plan}
        </Badge>
        <Badge
          variant={tenant.status === 'active' ? 'success' : 'danger'}
          size="sm"
          dot
        >
          {tenant.status}
        </Badge>
        <Badge variant="default" size="sm">
          {tenant.sites_count} sites
        </Badge>
        <Badge variant="default" size="sm">
          {tenant.conversations_count} convos / mo
        </Badge>
      </div>

      <Panel accent>
        <PanelHeader code="subscription_control" title="Plan & status" />
        <PanelBody>
          <TenantEditForm
            tenantId={tenant.id}
            initial={{
              plan: tenant.plan,
              status: tenant.status,
              notes: tenant.notes,
              plan_limits: tenant.plan_limits,
            }}
          />
        </PanelBody>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader code="users" title="Tenant users" />
          <PanelBody noPadding>
            <ul className="divide-y divide-zinc-900">
              {detail.users.map((u) => (
                <li key={u.id} className="flex items-center justify-between px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-sm text-zinc-200">{u.email}</p>
                    <p className="font-mono text-[10px] uppercase text-zinc-600">{u.role}</p>
                  </div>
                </li>
              ))}
              {detail.users.length === 0 && (
                <li className="px-5 py-6 text-sm text-zinc-500">No users</li>
              )}
            </ul>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader code="sites" title="Deployments" />
          <PanelBody noPadding>
            <ul className="divide-y divide-zinc-900">
              {detail.sites.map((s) => (
                <li key={s.id} className="px-4 py-3 sm:px-5">
                  <p className="text-sm text-zinc-200">{s.name}</p>
                  <p className="font-mono text-[10px] text-zinc-500">{s.domain}</p>
                </li>
              ))}
              {detail.sites.length === 0 && (
                <li className="px-5 py-6 text-sm text-zinc-500">No sites</li>
              )}
            </ul>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader code="billing_ids" title="Stripe identifiers" />
        <PanelBody className="space-y-2 font-mono text-xs text-zinc-400">
          <p>Customer: {tenant.stripe_customer_id ?? '—'}</p>
          <p>Subscription: {tenant.stripe_subscription_id ?? '—'}</p>
          <p>Tenant ID: {tenant.id}</p>
          <p>Created: {new Date(tenant.created_at).toLocaleString()}</p>
        </PanelBody>
      </Panel>

      {detail.feature_overrides.length > 0 && (
        <Panel>
          <PanelHeader code="overrides" title="Feature overrides" />
          <PanelBody>
            <div className="flex flex-wrap gap-2">
              {detail.feature_overrides.map((o) => (
                <Badge
                  key={o.feature_key}
                  variant={o.enabled ? 'success' : 'danger'}
                  size="sm"
                >
                  {o.feature_key}: {o.enabled ? 'on' : 'off'}
                </Badge>
              ))}
            </div>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
