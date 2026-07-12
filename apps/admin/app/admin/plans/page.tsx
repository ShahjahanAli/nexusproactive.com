import type { PlatformPlan } from '@nexus/shared-types';
import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/admin/ui/page-header';
import { PlanEditor } from '@/components/admin/plan-editor';

export default async function PlansPage() {
  const { plans } = await apiFetch<{ plans: PlatformPlan[] }>('/platform/plans');

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="plan_catalog"
        title="Subscription plans"
        description="Edit default limits, Stripe price IDs, and public availability for each tier."
      />
      <div className="space-y-4">
        {plans.map((plan) => (
          <PlanEditor key={plan.id} plan={plan} />
        ))}
      </div>
    </div>
  );
}
