import { apiFetch } from '@/lib/server-api';
import { BillingActions } from '@/components/billing-actions';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { ProgressBar } from '@/components/dashboard/ui/progress-bar';
import { Badge } from '@/components/dashboard/ui/badge';

export default async function BillingPage() {
  const plan = await apiFetch<{
    plan: string;
    limits: {
      max_sites: number;
      max_conversations_month: number;
      max_tokens_month: number;
    };
    usage: { conversations_count: number; tokens_used: number };
  }>('/tenant/plan');

  const sitesData = await apiFetch<{ sites: { id: string }[] }>('/sites').catch(() => ({
    sites: [],
  }));

  const convPct = Math.min(
    100,
    Math.round(
      (plan.usage.conversations_count / plan.limits.max_conversations_month) * 100,
    ),
  );
  const tokenPct = Math.min(
    100,
    Math.round((plan.usage.tokens_used / plan.limits.max_tokens_month) * 100),
  );
  const sitePct = Math.min(
    100,
    Math.round((sitesData.sites.length / plan.limits.max_sites) * 100),
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="billing_usage"
        title="Billing & Usage"
        description="Review your current plan, available capacity, and usage across sites, conversations, and tokens."
      />

      <Panel accent>
        <PanelHeader
          code="subscription"
            title="Current plan"
          action={<BillingActions />}
        />
        <PanelBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                Active plan
              </p>
              <p className="mt-1 text-2xl font-bold uppercase tracking-wide text-zinc-50 sm:text-3xl">
                {plan.plan}
              </p>
            </div>
            <Badge variant="tactical" dot>
                Billing active
            </Badge>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          code="capacity"
          title="Usage limits"
          subtitle="Current usage compared with your plan limits"
        />
        <PanelBody className="space-y-6">
          <ProgressBar
            label="Conversations / month"
            current={plan.usage.conversations_count}
            limit={plan.limits.max_conversations_month}
            pct={convPct}
          />
          <ProgressBar
            label="Token allocation"
            current={plan.usage.tokens_used}
            limit={plan.limits.max_tokens_month}
            pct={tokenPct}
          />
          <ProgressBar
            label="Site slots"
            current={sitesData.sites.length}
            limit={plan.limits.max_sites}
            pct={sitePct}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}
