'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Panel, PanelBody } from '@/components/dashboard/ui/panel';
import { Badge } from '@/components/dashboard/ui/badge';
import { Button, Input } from '@/components/dashboard/ui/button';
import { LanguageTag } from '@/components/dashboard/ui/language-tag';
import { formatDateTime } from '@/lib/datetime';
import { languageInfo } from '@/lib/language';

export interface EscalationRow {
  id: string;
  site_name: string;
  visitor_id: string;
  status: string;
  escalation_reason: string | null;
  escalated_at: string | null;
  assigned_email: string | null;
  detected_language?: string | null;
  handoff_brief?: string | null;
  message_count: number;
  last_message_at: string | null;
}

function languageLabel(code: string | null | undefined) {
  return languageInfo(code);
}

export function EscalationInbox({ escalations }: { escalations: EscalationRow[] }) {
  const router = useRouter();
  const [replying, setReplying] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedBrief, setExpandedBrief] = useState<string | null>(null);

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
      {escalations.map((e) => {
        const lang = languageLabel(e.detected_language);
        const briefOpen = expandedBrief === e.id;
        return (
          <Panel key={e.id}>
            <PanelBody className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-zinc-100">{e.site_name}</p>
                    <Badge variant={e.status === 'human' ? 'success' : 'warning'} size="sm">
                      {e.status}
                    </Badge>
                    <LanguageTag code={e.detected_language} size="sm" showName />
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
                      Escalated {formatDateTime(e.escalated_at)}
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

              {e.handoff_brief && (
                <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                      Agent handoff brief{lang ? ` · ${lang.name}` : ''}
                    </p>
                    <button
                      type="button"
                      className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
                      onClick={() => setExpandedBrief(briefOpen ? null : e.id)}
                    >
                      {briefOpen ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <p
                    className={`mt-2 whitespace-pre-wrap text-xs leading-relaxed text-zinc-300 ${
                      briefOpen ? '' : 'line-clamp-3'
                    }`}
                  >
                    {e.handoff_brief}
                  </p>
                </div>
              )}

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
        );
      })}
    </div>
  );
}
