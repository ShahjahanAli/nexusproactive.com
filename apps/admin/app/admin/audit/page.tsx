import type { AdminAuditEntry } from '@nexus/shared-types';
import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/admin/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/admin/ui/panel';
import { Badge } from '@/components/admin/ui/badge';

export default async function AuditPage() {
  const { entries, total } = await apiFetch<{
    entries: AdminAuditEntry[];
    total: number;
  }>('/platform/audit?limit=100');

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="audit_trail"
        title="Audit log"
        description={`${total} recorded platform action${total === 1 ? '' : 's'}.`}
      />

      <Panel>
        <PanelHeader code="events" title="Recent events" />
        <PanelBody noPadding>
          <ul className="divide-y divide-zinc-900">
            {entries.map((e) => (
              <li key={e.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="tactical" size="sm">
                        {e.action}
                      </Badge>
                      {e.target_type && (
                        <span className="font-mono text-[10px] text-zinc-500">
                          {e.target_type}
                          {e.target_id ? `:${e.target_id.slice(0, 8)}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-zinc-600">
                      {e.actor_email ?? 'system'} ·{' '}
                      {new Date(e.created_at).toLocaleString()}
                    </p>
                  </div>
                  {e.meta && Object.keys(e.meta).length > 0 && (
                    <pre className="max-w-md overflow-x-auto rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-[10px] text-zinc-500">
                      {JSON.stringify(e.meta)}
                    </pre>
                  )}
                </div>
              </li>
            ))}
            {entries.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-zinc-500">
                No audit events yet.
              </li>
            )}
          </ul>
        </PanelBody>
      </Panel>
    </div>
  );
}
