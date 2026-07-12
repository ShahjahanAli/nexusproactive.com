import type { FeatureFlag } from '@nexus/shared-types';
import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/admin/ui/page-header';
import { FeatureEditor } from '@/components/admin/feature-editor';

export default async function FeaturesPage() {
  const { features } = await apiFetch<{ features: FeatureFlag[] }>('/platform/features');

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="feature_flags"
        title="Features"
        description="Toggle product capabilities globally and control which plans include them."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {features.map((feature) => (
          <FeatureEditor key={feature.key} feature={feature} />
        ))}
      </div>
    </div>
  );
}
