import Link from 'next/link';
import { apiFetch } from '@/lib/server-api';
import type { Site } from '@nexus/shared-types';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody } from '@/components/dashboard/ui/panel';
import { EmptyState } from '@/components/dashboard/ui/empty-state';
import { ButtonLink } from '@/components/dashboard/ui/button';
import { Badge } from '@/components/dashboard/ui/badge';

export default async function SitesPage() {
  const data = await apiFetch<{ sites: Site[] }>('/sites').catch(() => ({
    sites: [],
  }));

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="deployments"
        title="Deployments"
        description="Active site integrations and their Action Graph ingestion status."
        action={
          <ButtonLink href="/app/onboarding" size="sm">
            + New deployment
          </ButtonLink>
        }
      />

      {data.sites.length === 0 ? (
        <EmptyState
          title="Zero deployments"
          description="No sites connected. Deploy your first integration to begin action graph discovery."
          actionLabel="Start deployment"
          actionHref="/app/onboarding"
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {data.sites.map((site) => (
              <Panel key={site.id} accent>
                <PanelBody className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-zinc-100">{site.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-zinc-500">{site.domain}</p>
                    </div>
                    <Badge variant="success" size="sm" dot>
                      Active
                    </Badge>
                  </div>
                  <p className="truncate font-mono text-[11px] text-zinc-600">
                    {site.backend_base_url}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/app/sites/${site.id}`}
                      className="font-mono text-[10px] uppercase tracking-wider text-emerald-500"
                    >
                      Action graph →
                    </Link>
                    <Link
                      href={`/app/sites/${site.id}/edit`}
                      className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
                    >
                      Edit deployment
                    </Link>
                  </div>
                </PanelBody>
              </Panel>
            ))}
          </div>

          {/* Desktop table */}
          <Panel className="hidden lg:block">
            <PanelBody noPadding>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800/80 bg-zinc-900/40">
                      {['Designation', 'Domain', 'Backend endpoint', 'Status', ''].map((h) => (
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
                    {data.sites.map((site) => (
                      <tr
                        key={site.id}
                        className="border-b border-zinc-800/50 transition hover:bg-zinc-900/30"
                      >
                        <td className="px-5 py-4 font-medium text-zinc-100">{site.name}</td>
                        <td className="px-5 py-4 font-mono text-xs text-zinc-400">{site.domain}</td>
                        <td className="max-w-xs truncate px-5 py-4 font-mono text-xs text-zinc-500">
                          {site.backend_base_url}
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant="success" size="sm" dot>
                            Active
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-4">
                            <Link
                              href={`/app/sites/${site.id}/edit`}
                              className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
                            >
                              Edit
                            </Link>
                            <Link
                              href={`/app/sites/${site.id}`}
                              className="font-mono text-[10px] uppercase tracking-wider text-emerald-500 hover:text-emerald-400"
                            >
                              Action graph
                            </Link>
                          </div>
                        </td>
                      </tr>
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
