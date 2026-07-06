import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/server-api';
import type { Site } from '@nexus/shared-types';
import { SiteEditForm } from '@/components/dashboard/site-edit-form';
import { buildEmbedSnippet } from '@/lib/embed-snippet';

export default async function SiteEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await apiFetch<{ site: Site }>(`/sites/${id}`).catch(() => null);

  if (!data?.site) {
    notFound();
  }

  return (
    <SiteEditForm
      site={data.site}
      embedSnippet={buildEmbedSnippet(data.site.id)}
    />
  );
}
