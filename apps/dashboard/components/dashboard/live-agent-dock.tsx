'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { AuthUser } from '@nexus/shared-types';
import { formatDateTime } from '@/lib/datetime';
import { Button } from './ui/button';

interface Thread {
  id: string;
  site_id: string;
  site_name: string;
  visitor_id: string;
  status: string;
  escalation_reason: string | null;
  escalated_at: string | null;
  assigned_to: string | null;
  assigned_email: string | null;
  message_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  agent_name: string | null;
  created_at: string;
}

function canUseInbox(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'agent';
}

function shortVisitor(id: string): string {
  return id.length > 12 ? `${id.slice(0, 10)}…` : id;
}

/** e.g. 16 Jul 2026, 4:14 am */
function timeLabel(value: string | null): string {
  if (!value) return '';
  try {
    return formatDateTime(value);
  } catch {
    return '';
  }
}

function statusMeta(status: string): { label: string; className: string } {
  if (status === 'escalated') {
    return { label: 'Waiting', className: 'bg-amber-500/20 text-amber-400' };
  }
  if (status === 'human') {
    return { label: 'Human', className: 'bg-emerald-500/20 text-emerald-400' };
  }
  return { label: 'AI', className: 'bg-sky-500/20 text-sky-400' };
}

function isNearBottom(el: HTMLElement, thresholdPx = 96): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx;
}

function messagesUnchanged(prev: ChatMessage[], next: ChatMessage[]): boolean {
  if (prev.length !== next.length) return false;
  return prev.every(
    (m, i) =>
      m.id === next[i]?.id &&
      m.content === next[i]?.content &&
      m.role === next[i]?.role &&
      m.created_at === next[i]?.created_at,
  );
}

export function LiveAgentDock({
  user,
  open = true,
  onOpenChange,
}: {
  user: AuthUser | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const prevActiveIdRef = useRef<string | null>(null);
  const active = threads.find((t) => t.id === activeId) ?? null;

  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (!next) setExpanded(false);
  };

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/escalations?limit=50&assigned=any&includeOpen=1', {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { escalations?: Thread[] };
      setThreads(data.escalations ?? []);
    } catch {
      /* ignore poll errors */
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}/messages`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: ChatMessage[] };
      const next = data.messages ?? [];
      setMessages((prev) => (messagesUnchanged(prev, next) ? prev : next));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!canUseInbox(user?.role)) return;
    void loadThreads();
    const t = setInterval(() => void loadThreads(), 4000);
    return () => clearInterval(t);
  }, [user?.role, loadThreads]);

  useEffect(() => {
    if (!activeId || !expanded) return;
    void loadMessages(activeId);
    const t = setInterval(() => void loadMessages(activeId), 2500);
    return () => clearInterval(t);
  }, [activeId, expanded, loadMessages]);

  useEffect(() => {
    if (!expanded || !activeId) return;
    const switchedThread = prevActiveIdRef.current !== activeId;
    if (switchedThread) {
      prevActiveIdRef.current = activeId;
      stickToBottomRef.current = true;
    }
    if (!stickToBottomRef.current) return;
    // Wait for bubbles to paint before scrolling the container (not the page).
    requestAnimationFrame(() => scrollMessagesToBottom(switchedThread ? 'auto' : 'smooth'));
  }, [messages, activeId, expanded, scrollMessagesToBottom]);

  if (!canUseInbox(user?.role)) return null;

  const waiting = threads.filter((t) => t.status === 'escalated').length;

  async function openThread(id: string) {
    stickToBottomRef.current = true;
    setActiveId(id);
    setExpanded(true);
    setError(null);
    setDraft('');
    await loadMessages(id);
    const thread = threads.find((t) => t.id === id);
    if (thread && thread.status === 'escalated') {
      await fetch(`/api/escalations/${id}/claim`, { method: 'POST' });
      void loadThreads();
    }
  }

  async function sendReply(e?: FormEvent) {
    e?.preventDefault();
    if (!activeId || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/escalations/${activeId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: draft.trim() }),
    });
    setSending(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Failed to send');
      return;
    }
    setDraft('');
    stickToBottomRef.current = true;
    await Promise.all([loadMessages(activeId), loadThreads()]);
  }

  async function resolveChat(resumeAi: boolean) {
    if (!activeId) return;
    await fetch(`/api/escalations/${activeId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeAi }),
    });
    setExpanded(false);
    setActiveId(null);
    setMessages([]);
    void loadThreads();
  }

  return (
    <>
      {/* Desktop dock */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 hidden flex-col border-l border-zinc-800/80 bg-zinc-950/98 backdrop-blur-xl transition-[width] duration-200 lg:flex ${
          open ? 'w-[340px]' : 'w-12'
        }`}
      >
        {open ? (
          <>
            <div className="flex h-14 items-center justify-between border-b border-zinc-800/80 px-3">
              <div>
                <p className="text-sm font-semibold text-zinc-100">Live chats</p>
                <p className="text-[11px] text-zinc-500">
                  {threads.length} active
                  {waiting > 0 ? ` · ${waiting} waiting` : ''}
                </p>
              </div>
              <button
                type="button"
                aria-label="Collapse chat panel"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {threads.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-500">
                  No active chats yet. AI and human threads from the last 72 hours show here.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-800/60">
                  {threads.map((t) => {
                    const selected = t.id === activeId;
                    const meta = statusMeta(t.status);
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => void openThread(t.id)}
                          className={`flex w-full gap-3 px-3 py-3 text-left transition ${
                            selected ? 'bg-emerald-500/10' : 'hover:bg-zinc-900/70'
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${meta.className}`}
                          >
                            {t.site_name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate text-sm font-medium text-zinc-100">
                                    {shortVisitor(t.visitor_id)}
                                  </span>
                                  <span
                                    className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${meta.className}`}
                                  >
                                    {meta.label}
                                  </span>
                                </span>
                              </span>
                              <span className="max-w-[7.5rem] shrink-0 text-right text-[10px] leading-tight text-zinc-500">
                                {timeLabel(t.last_message_at ?? t.escalated_at ?? t.created_at)}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                              {t.site_name}
                              {t.assigned_email ? ` · ${t.assigned_email.split('@')[0]}` : ''}
                            </span>
                            <span className="mt-1 block truncate text-xs text-zinc-400">
                              {t.last_message_preview ||
                                t.escalation_reason ||
                                (t.status === 'open' ? 'AI conversation in progress…' : 'Waiting for agent…')}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            aria-label="Open live chats"
            onClick={() => setOpen(true)}
            className="flex h-full w-full flex-col items-center gap-3 pt-4 text-zinc-400 hover:bg-zinc-900 hover:text-emerald-400"
          >
            <span className="relative">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              {waiting > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-zinc-950">
                  {waiting}
                </span>
              )}
            </span>
            <span className="rotate-180 text-[10px] font-medium tracking-wider [writing-mode:vertical-rl]">
              Chats
            </span>
          </button>
        )}
      </aside>

      {/* Expanded WhatsApp-style chat window */}
      {expanded && active && (
        <div
          className={`fixed bottom-4 z-50 flex h-[min(640px,calc(100vh-5rem))] w-[min(420px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950 shadow-2xl shadow-black/50 ${
            open ? 'right-4 lg:right-[calc(340px+1rem)]' : 'right-4 lg:right-16'
          }`}
        >
          <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/90 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">
              {active.site_name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-100">
                {shortVisitor(active.visitor_id)}
              </p>
              <p className="truncate text-[11px] text-zinc-500">
                {active.site_name} · {active.status}
                {active.assigned_email ? ` · ${active.assigned_email}` : ''}
              </p>
            </div>
            <Link
              href={`/app/visitors/${encodeURIComponent(active.visitor_id)}`}
              className="text-[10px] uppercase tracking-wider text-emerald-500"
            >
              Profile
            </Link>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => {
                setExpanded(false);
                setActiveId(null);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div
            ref={messagesContainerRef}
            onScroll={() => {
              const el = messagesContainerRef.current;
              if (!el) return;
              stickToBottomRef.current = isNearBottom(el);
            }}
            className="flex-1 space-y-2 overflow-y-auto px-3 py-4"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
              backgroundSize: '18px 18px',
            }}
          >
            {messages
              .filter((m) => m.role !== 'tool')
              .map((m) => {
                const isVisitor = m.role === 'user';
                const isSystem = m.role === 'system';
                if (isSystem) {
                  return (
                    <div key={m.id} className="flex justify-center px-6">
                      <p className="rounded-full bg-zinc-900/80 px-3 py-1 text-center text-[10px] text-zinc-500">
                        {m.content}
                      </p>
                    </div>
                  );
                }
                return (
                  <div key={m.id} className={`flex ${isVisitor ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                        isVisitor
                          ? 'rounded-bl-md bg-zinc-800 text-zinc-100'
                          : 'rounded-br-md bg-emerald-600 text-white'
                      }`}
                    >
                      {!isVisitor && m.agent_name && (
                        <p className="mb-0.5 text-[10px] font-medium text-emerald-100/80">
                          {m.agent_name}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <p
                        className={`mt-1 text-right text-[9px] ${
                          isVisitor ? 'text-zinc-500' : 'text-emerald-100/70'
                        }`}
                      >
                        {timeLabel(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="border-t border-zinc-800 bg-zinc-950 px-3 py-2">
            <div className="mb-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void resolveChat(true)}>
                Return to AI
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void resolveChat(false)}>
                Close chat
              </Button>
            </div>
            {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
            <form onSubmit={(e) => void sendReply(e)} className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendReply();
                  }
                }}
                rows={1}
                placeholder="Type a message…"
                className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
              />
              <Button type="submit" size="sm" disabled={sending || !draft.trim()}>
                Send
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile floating launcher */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setExpanded(true);
          if (!activeId && threads[0]) void openThread(threads[0].id);
        }}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 lg:hidden"
        aria-label="Open live chats"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        {waiting > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-zinc-950">
            {waiting}
          </span>
        )}
      </button>
    </>
  );
}
