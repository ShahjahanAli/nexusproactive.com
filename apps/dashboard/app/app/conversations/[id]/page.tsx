import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody } from '@/components/dashboard/ui/panel';
import { Badge } from '@/components/dashboard/ui/badge';

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await apiFetch<{
    messages: Array<{
      id: string;
      role: string;
      content: string | null;
      agent_name: string | null;
      created_at: string;
    }>;
  }>(`/conversations/${id}/messages`).catch(() => ({ messages: [] }));

  return (
    <div className="space-y-6">
      <PageHeader code={`comms/${id.slice(0, 8)}`} title="Conversation log" />
      <Panel>
        <PanelBody className="space-y-3">
          {data.messages.map((m) => (
            <div key={m.id} className="rounded border border-zinc-800/80 bg-zinc-950/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge size="sm" variant={m.role === 'user' ? 'info' : 'default'}>
                  {m.role}
                </Badge>
                {m.agent_name && (
                  <span className="font-mono text-[10px] text-zinc-600">{m.agent_name}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-zinc-300">{m.content}</p>
            </div>
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}
