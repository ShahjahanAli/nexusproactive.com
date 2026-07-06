import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody } from '@/components/dashboard/ui/panel';
import { EmptyState } from '@/components/dashboard/ui/empty-state';
import { Badge } from '@/components/dashboard/ui/badge';
import Link from 'next/link';

interface ConversationRow {
  id: string;
  site_name: string;
  visitor_id: string;
  active_agent: string;
  message_count: number;
  tokens_used: number;
  created_at: string;
}

export default async function ConversationsPage() {
  const data = await apiFetch<{ conversations: ConversationRow[] }>(
    '/conversations',
  ).catch(() => ({ conversations: [] }));

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="comms_log"
        title="Communications"
        description="Live conversation feed across all deployments."
      />

      {data.conversations.length === 0 ? (
        <EmptyState
          title="No transmissions"
          description="Conversations appear here once visitors interact with the embedded widget."
        />
      ) : (
        <div className="space-y-3">
          {data.conversations.map((c) => (
            <Panel key={c.id}>
              <PanelBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-zinc-100">{c.site_name}</p>
                    <Badge variant="tactical" size="sm">
                      {c.active_agent}
                    </Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    {c.message_count} msgs · {c.tokens_used.toLocaleString()} tokens ·{' '}
                    <Link
                      href={`/app/visitors/${encodeURIComponent(c.visitor_id)}`}
                      className="text-emerald-500 hover:text-emerald-400"
                    >
                      visitor {c.visitor_id.slice(0, 8)}…
                    </Link>
                  </p>
                </div>
                <Link
                  href={`/app/conversations/${c.id}`}
                  className="font-mono text-[10px] uppercase tracking-wider text-emerald-500"
                >
                  Open log →
                </Link>
              </PanelBody>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
