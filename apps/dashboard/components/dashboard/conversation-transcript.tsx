import { dayKey, formatDayHeading, formatTime } from '@/lib/datetime';

export interface TranscriptMessage {
  id: string;
  role: string;
  content: string | null;
  agent_name: string | null;
  created_at: string;
  meta?: Record<string, unknown> | null;
}

export interface TranscriptConsult {
  id: string;
  consult_type: string;
  target_key: string;
  question: string;
  answer: string | null;
  status: string;
  latency_ms: number | null;
  created_at: string;
}

/** Human agents reply as `assistant` but carry a person's name in agent_name. */
const AI_AGENTS = new Set([
  'orchestrator',
  'billing',
  'technical',
  'sales',
  'account',
  'unknown',
]);

function isHumanReply(m: TranscriptMessage): boolean {
  const name = m.agent_name?.trim();
  if (!name) return false;
  return !AI_AGENTS.has(name.toLowerCase());
}

function systemEventLabel(m: TranscriptMessage): string {
  const kind = typeof m.meta?.kind === 'string' ? m.meta.kind : '';
  switch (kind) {
    case 'escalation_notified':
      return 'Handoff requested — waiting for a human agent';
    case 'agent_joined':
      return 'A human agent joined the chat';
    case 'ai_resume':
      return 'Handed back to the AI assistant';
    case 'conversation_closed':
      return 'Conversation closed';
    default:
      return m.content?.trim() || 'System event';
  }
}

function provenanceCount(m: TranscriptMessage): number {
  const p = m.meta?.provenance;
  return Array.isArray(p) ? p.length : 0;
}

function DaySeparator({ value }: { value: string }) {
  return (
    <div className="relative py-2">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-zinc-800/80" />
      </div>
      <div className="relative flex justify-center">
        <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] font-medium text-zinc-400">
          {formatDayHeading(value)}
        </span>
      </div>
    </div>
  );
}

function SystemEvent({ message }: { message: TranscriptMessage }) {
  return (
    <div className="flex justify-center">
      <div className="max-w-xl rounded-full border border-amber-500/25 bg-amber-500/5 px-3 py-1.5 text-center text-[11px] leading-5 text-amber-500">
        {systemEventLabel(message)}
        <span className="ml-1.5 font-mono text-[10px] text-zinc-500">
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: TranscriptMessage }) {
  const isVisitor = message.role === 'user';
  const human = isHumanReply(message);
  const sources = provenanceCount(message);

  const who = isVisitor
    ? 'Visitor'
    : human
      ? `${message.agent_name} · human agent`
      : message.agent_name
        ? `AI · ${message.agent_name}`
        : 'AI assistant';

  return (
    <div className={`flex ${isVisitor ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[75%] ${isVisitor ? 'items-end' : 'items-start'}`}>
        <div
          className={`mb-1 flex items-center gap-2 text-[11px] ${
            isVisitor ? 'justify-end' : 'justify-start'
          }`}
        >
          <span
            className={
              isVisitor
                ? 'font-medium text-cyan-400'
                : human
                  ? 'font-medium text-amber-500'
                  : 'font-medium text-emerald-500'
            }
          >
            {who}
          </span>
          <span className="font-mono text-[10px] text-zinc-500">
            {formatTime(message.created_at)}
          </span>
        </div>
        <div
          className={`rounded-2xl border px-3.5 py-2.5 text-sm leading-6 whitespace-pre-wrap ${
            isVisitor
              ? 'rounded-br-sm border-cyan-500/25 bg-cyan-500/5 text-zinc-200'
              : human
                ? 'rounded-bl-sm border-amber-500/25 bg-amber-500/5 text-zinc-200'
                : 'rounded-bl-sm border-zinc-800 bg-zinc-900/70 text-zinc-200'
          }`}
        >
          {message.content?.trim() || <span className="text-zinc-500">(empty message)</span>}
        </div>
        {sources > 0 && (
          <p
            className={`mt-1 font-mono text-[10px] text-zinc-500 ${
              isVisitor ? 'text-right' : ''
            }`}
          >
            {sources} source{sources === 1 ? '' : 's'} used
          </p>
        )}
      </div>
    </div>
  );
}

function ConsultCard({ consult }: { consult: TranscriptConsult }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] sm:max-w-[75%]">
        <div className="mb-1 flex items-center gap-2 text-[11px]">
          <span className="font-medium text-violet-400">
            Internal consult · {consult.target_key}
          </span>
          <span className="font-mono text-[10px] text-zinc-500">
            {formatTime(consult.created_at)}
            {consult.latency_ms ? ` · ${Math.round(consult.latency_ms / 100) / 10}s` : ''}
          </span>
        </div>
        <div className="rounded-2xl rounded-bl-sm border border-violet-500/25 bg-violet-500/5 px-3.5 py-2.5">
          <p className="text-xs leading-5 text-zinc-300">
            <span className="text-zinc-500">Asked:</span> {consult.question}
          </p>
          {consult.answer && (
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-400">
              <span className="text-zinc-500">Brief:</span> {consult.answer}
            </p>
          )}
          {consult.status !== 'completed' && (
            <p className="mt-2 font-mono text-[10px] uppercase text-amber-500">
              {consult.status}
            </p>
          )}
        </div>
        <p className="mt-1 text-[10px] text-zinc-500">
          Not shown to the visitor — the CX Agent folded this into its reply.
        </p>
      </div>
    </div>
  );
}

type Entry =
  | { kind: 'message'; at: string; message: TranscriptMessage }
  | { kind: 'consult'; at: string; consult: TranscriptConsult };

export function ConversationTranscript({
  messages,
  consults = [],
  showConsults = true,
}: {
  messages: TranscriptMessage[];
  consults?: TranscriptConsult[];
  showConsults?: boolean;
}) {
  const entries: Entry[] = [
    ...messages.map((m) => ({ kind: 'message' as const, at: m.created_at, message: m })),
    ...(showConsults
      ? consults.map((c) => ({ kind: 'consult' as const, at: c.created_at, consult: c }))
      : []),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500">No messages in this conversation yet.</p>;
  }

  let lastDay = '';

  return (
    <div className="space-y-4">
      {entries.map((entry) => {
        const day = dayKey(entry.at);
        const showDay = day !== lastDay;
        lastDay = day;

        return (
          <div key={entry.kind === 'message' ? entry.message.id : entry.consult.id}>
            {showDay && <DaySeparator value={entry.at} />}
            {entry.kind === 'consult' ? (
              <ConsultCard consult={entry.consult} />
            ) : entry.message.role === 'system' ? (
              <SystemEvent message={entry.message} />
            ) : (
              <Bubble message={entry.message} />
            )}
          </div>
        );
      })}
    </div>
  );
}
