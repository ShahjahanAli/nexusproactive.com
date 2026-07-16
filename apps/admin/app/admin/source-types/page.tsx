import type { OpenApiSourceType } from '@nexus/shared-types';
import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/admin/ui/page-header';
import {
  SourceTypeCreateForm,
  SourceTypeEditor,
} from '@/components/admin/source-type-editor';

export default async function SourceTypesPage() {
  const { types } = await apiFetch<{ types: OpenApiSourceType[] }>(
    '/platform/source-types',
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="openapi_source_types"
        title="OpenAPI Source Types"
        description="Define typed OpenAPI categories tenants attach to each site. Routing controls which chat specialists prefer those tools."
      />
      <SourceTypeCreateForm />
      <div className="grid gap-4 lg:grid-cols-2">
        {types.map((type) => (
          <SourceTypeEditor key={type.key} type={type} />
        ))}
      </div>
    </div>
  );
}
