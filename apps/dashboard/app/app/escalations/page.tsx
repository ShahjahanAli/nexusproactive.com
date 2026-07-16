import { apiFetch } from '@/lib/server-api';
import { buildListQuery, currentPage } from '@/lib/list-params';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { ListPagination } from '@/components/dashboard/ui/pagination';
import { ListFilters } from '@/components/dashboard/list-filters';
import { EscalationInbox, EscalationRow } from '@/components/dashboard/escalation-inbox';
import type { Site } from '@nexus/shared-types';

export default async function EscalationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    siteId?: string;
    status?: string;
    assigned?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = currentPage(params);
  const qs = buildListQuery(params, ['q', 'siteId', 'status', 'assigned']);
  if (page > 1) qs.set('page', String(page));

  const [sitesData, data] = await Promise.all([
    apiFetch<{ sites: Site[] }>('/sites').catch(() => ({ sites: [] })),
    apiFetch<{ escalations: EscalationRow[]; total: number; limit: number }>(
      `/escalations?${qs.toString()}`,
    ).catch(() => ({ escalations: [], total: 0, limit: 20 })),
  ]);

  const limit = data.limit || 20;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Support Inbox"
        description="Manage escalated conversations, respond as a human agent, and return the conversation to AI when appropriate."
      />

      <Panel>
        <PanelHeader title="Filters" subtitle="Find escalations by site, status, or assignment" />
        <PanelBody>
          <ListFilters
            basePath="/app/escalations"
            initialValues={params}
            searchPlaceholder="Search visitor ID"
            sites={sitesData.sites.map((s) => ({ id: s.id, name: s.name }))}
            selects={[
              {
                name: 'status',
                label: 'Status',
                options: [
                  { value: '', label: 'All statuses' },
                  { value: 'escalated', label: 'Waiting in queue' },
                  { value: 'human', label: 'With human agent' },
                ],
              },
              {
                name: 'assigned',
                label: 'Assignment',
                options: [
                  { value: '', label: 'Any assignment' },
                  { value: 'mine', label: 'Assigned to me' },
                  { value: 'unassigned', label: 'Unassigned' },
                ],
              },
            ]}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title={`${data.total.toLocaleString()} escalated conversations`}
          subtitle={data.escalations.length ? 'Most recent first' : 'No active escalations'}
        />
        <PanelBody>
          <EscalationInbox escalations={data.escalations} />
          <ListPagination
            total={data.total}
            limit={limit}
            page={page}
            basePath="/app/escalations"
            params={params}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}
