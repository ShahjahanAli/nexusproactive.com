import Link from 'next/link';
import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { Badge } from '@/components/dashboard/ui/badge';
import { StatCard } from '@/components/dashboard/ui/stat-card';
import {
  ConversationTranscript,
  type TranscriptConsult,
  type TranscriptMessage,
} from '@/components/dashboard/conversation-transcript';
import { LanguageTag } from '@/components/dashboard/ui/language-tag';
import { formatDateTime, formatDuration, formatRelative } from '@/lib/datetime';

interface ConversationDetail {
  id: string;
  site_id: string;
  site_name: string;
  visitor_id: string;
  status: string;
  active_agent: string;
  created_at: string;
  escalated_at: string | null;
  tokens_used: number;
  detected_language: string | null;
  handoff_brief: string | null;
  cx_agent_id: string | null;
  cx_agent_name: string | null;
  assigned_agent: string | null;
  rating_score: number | null;
  rating_comment: string | null;
  message_count: number;
  visitor_messages: number;
  agent_messages: number;
  last_message_at: string | null;
  consults: number;
  sales_events: number;
}

interface ConversationResponse {
  conversation?: ConversationDetail;
  messages: TranscriptMessage[];
  consults?: TranscriptConsult[];
  detected_language?: string | null;
  handoff_brief?: string | null;
}

const statusVariant: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
  open: 'success',
  escalated: 'warning',
  human: 'info',
  closed: 'default',
};

const statusLabel: Record<string, string> = {
  open: 'AI handling',
  escalated: 'Waiting for human',
  human: 'Human agent live',
  closed: 'Closed',
};

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="min-w-0 truncate text-right text-xs text-zinc-300">{value}</span>
    </div>
  );
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data: ConversationResponse = await apiFetch<ConversationResponse>(
    `/conversations/${id}/messages`,
  ).catch(() => ({ messages: [] }));

  const conv = data.conversation;
  const messages = data.messages ?? [];
  const consults = data.consults ?? [];
  const langCode = conv?.detected_language ?? data.detected_language ?? null;
  const lang = langCode?.trim().toUpperCase() || null;
  const brief = conv?.handoff_brief ?? data.handoff_brief ?? null;

  const startedAt = conv?.created_at ?? messages[0]?.created_at ?? null;
  const lastAt = conv?.last_message_at ?? messages[messages.length - 1]?.created_at ?? null;
  const duration = startedAt && lastAt ? formatDuration(startedAt, lastAt) : '—';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversation log"
        description={
          startedAt
            ? `Started ${formatDateTime(startedAt)}${
                lastAt ? ` · last message ${formatRelative(lastAt)}` : ''
              }`
            : undefined
        }
        action={
          <Link
            href="/app/conversations"
            className="text-sm font-medium text-emerald-500 hover:text-emerald-400"
          >
            ← All conversations
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant[conv?.status ?? ''] ?? 'default'} dot={conv?.status === 'human'}>
          {statusLabel[conv?.status ?? ''] ?? conv?.status ?? 'unknown'}
        </Badge>
        {conv?.cx_agent_name && <Badge variant="tactical">CX · {conv.cx_agent_name}</Badge>}
        {conv?.assigned_agent && <Badge variant="info">Agent · {conv.assigned_agent}</Badge>}
        <LanguageTag code={langCode} showName />
        {typeof conv?.rating_score === 'number' && (
          <Badge variant="success">Rated {conv.rating_score}/5</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Messages"
          value={(conv?.message_count ?? messages.length).toLocaleString()}
          sub={
            conv
              ? `${conv.visitor_messages} from visitor · ${conv.agent_messages} replies`
              : undefined
          }
        />
        <StatCard label="Duration" value={duration} sub="First to last message" />
        <StatCard
          label="Tokens"
          value={(conv?.tokens_used ?? 0).toLocaleString()}
          sub="AI usage for this thread"
        />
        <StatCard
          label="Internal consults"
          value={(conv?.consults ?? consults.length).toLocaleString()}
          sub={
            conv?.sales_events
              ? `${conv.sales_events} sales event${conv.sales_events === 1 ? '' : 's'}`
              : 'Specialist assists'
          }
        />
      </div>

      {brief && (
        <Panel>
          <PanelHeader
            title="Agent handoff brief"
            subtitle={
              lang ? `English summary · visitor language ${lang}` : 'English summary for human agents'
            }
          />
          <PanelBody>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{brief}</p>
          </PanelBody>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Panel>
          <PanelHeader
            title="Transcript"
            subtitle="Visitor on the right, agents on the left. Amber notes are system events."
          />
          <PanelBody>
            <ConversationTranscript messages={messages} consults={consults} />
          </PanelBody>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Details" />
            <PanelBody className="divide-y divide-zinc-800/60 !py-2">
              <MetaRow label="Site" value={conv?.site_name ?? '—'} />
              <MetaRow
                label="Visitor"
                value={
                  conv ? (
                    <Link
                      href={`/app/visitors/${encodeURIComponent(conv.visitor_id)}`}
                      className="text-emerald-500 hover:text-emerald-400"
                    >
                      {conv.visitor_id.slice(0, 12)}…
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <MetaRow label="Specialist" value={conv?.active_agent ?? '—'} />
              <MetaRow
                label="Started"
                value={startedAt ? formatDateTime(startedAt) : '—'}
              />
              <MetaRow
                label="Last message"
                value={lastAt ? formatDateTime(lastAt) : '—'}
              />
              {conv?.escalated_at && (
                <MetaRow label="Escalated" value={formatDateTime(conv.escalated_at)} />
              )}
              <MetaRow label="Thread ID" value={<span className="font-mono">{id.slice(0, 8)}…</span>} />
            </PanelBody>
          </Panel>

          {typeof conv?.rating_score === 'number' && (
            <Panel>
              <PanelHeader title="Visitor rating" subtitle="Collected at the end of the chat" />
              <PanelBody>
                <p className="text-2xl font-bold text-emerald-500">{conv.rating_score}/5</p>
                {conv.rating_comment && (
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    “{conv.rating_comment}”
                  </p>
                )}
              </PanelBody>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
