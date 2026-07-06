'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Panel, PanelBody } from '@/components/dashboard/ui/panel';
import { Badge } from '@/components/dashboard/ui/badge';
import { Button, Input } from '@/components/dashboard/ui/button';

export interface EscalationRow {
  id: string;
  site_name: string;
  visitor_id: string;
  status: string;
  escalation_reason: string | null;
  escalated_at: string | null;
  assigned_email: string | null;
  message_count: number;
  last_message_at: string | null;
}

export function EscalationInbox({ escalations }: { escalations: EscalationRow[] }) {
  const router = useRouter();
  const [replying, setReplying] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function claim(id: string) {
    setLoading(true);
    await fetch(`/api/escalations/${id}/claim`, { method: 'POST' });
    setLoading(false);
    router.refresh();
  }

  async function sendReply(id: string) {
    if (!message.trim()) return;
    setLoading(true);
    await fetch(`/api/escalations/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    setMessage('');
    setReplying(null);
    setLoading(false);
    router.refresh();
  }

  async function resolve(id: string, resumeAi: boolean) {
    setLoading(true);
    await fetch(`/api/escalations/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeAi }),
    });
    setLoading(false);
    router.refresh();
  }

  if (escalations.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No escalated chats — visitors can click Human in the widget.</p>
    );
  }

  return (
    <div className="space-y-3">
      {escalations.map((e) => (
        <Panel key={e.id}>
          <PanelBody className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-zinc-100">{e.site_name}</p>
                  <Badge variant={e.status === 'human' ? 'success' : 'warning'} size="sm">
                    {e.status}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-zinc-500">
                  {e.message_count} msgs ·{' '}
                  <Link
                    href={`/app/visitors/${encodeURIComponent(e.visitor_id)}`}
                    className="text-emerald-500"
                  >
                    visitor {e.visitor_id.slice(0, 10)}…
                  </Link>
                  {e.assigned_email ? ` · ${e.assigned_email}` : ''}
                </p>
                {e.escalated_at && (
                  <p className="font-mono text-[10px] text-zinc-600">
                    Escalated {new Date(e.escalated_at).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/app/conversations/${e.id}`}
                  className="font-mono text-[10px] uppercase tracking-wider text-emerald-500"
                >
                  View log →
                </Link>
                {e.status === 'escalated' && (
                  <Button size="sm" disabled={loading} onClick={() => claim(e.id)}>
                    Claim
                  </Button>
                )}
                {e.status === 'human' && (
                  <Button size="sm" variant="secondary" onClick={() => setReplying(e.id)}>
                    Reply
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => resolve(e.id, true)}
                >
                  Return to AI
                </Button>
              </div>
            </div>

            {replying === e.id && (
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(ev) => setMessage(ev.target.value)}
                  placeholder="Type a reply to the visitor…"
                  className="flex-1"
                />
                <Button disabled={loading} onClick={() => sendReply(e.id)}>
                  Send
                </Button>
              </div>
            )}
          </PanelBody>
        </Panel>
      ))}
    </div>
  );
}
