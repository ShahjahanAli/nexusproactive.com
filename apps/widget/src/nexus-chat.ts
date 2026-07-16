import { renderMarkdown, streamingPlainText } from './formatMessage';

/** Resolve at call time so host pages can set window.NEXUS_API_URL before/after script load. */
function apiUrl(): string {
  if (typeof window !== 'undefined') {
    const configured = (window as unknown as { NEXUS_API_URL?: string }).NEXUS_API_URL?.trim();
    if (configured) return configured.replace(/\/$/, '');
  }
  return 'http://localhost:5000';
}

const RECOVERY_REPLY =
  /sorry — (i could not finish|connection (issue|dropped)|i hit a temporary glitch|something went wrong)/i;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
}

interface TraceStep {
  type: string;
  agent?: string;
  detail?: string;
  timestamp: string;
}

interface WidgetTheme {
  primaryColor?: string;
  primaryColorDark?: string;
  position?: 'bottom-right' | 'bottom-left';
  title?: string;
  subtitle?: string;
  escalationEnabled?: boolean;
  proactiveEnabled?: boolean;
  maxUserMessages?: number;
  whatsappNumber?: string;
  whatsappPrefillMessage?: string;
  guardrailMessage?: string;
}

export class NexusChatElement extends HTMLElement {
  private shadow: ShadowRoot;
  private messages: ChatMessage[] = [];
  private conversationId?: string;
  private visitorId: string;
  private siteId: string;
  private trace: TraceStep[] = [];
  private showTrace = false;
  private minimized = true;
  private conversationStatus = 'open';
  private widgetTheme: WidgetTheme = {};
  private humanPollTimer?: ReturnType<typeof setInterval>;
  private idleTimer?: ReturnType<typeof setInterval>;
  private lastActivityAt = Date.now();
  private renderedMessageCount = 0;
  private anonymousVisitorId?: string;
  private aiLocked = false;
  /** Prevents parallel /v1/chat SSE requests. */
  private sending = false;
  private chatAbort?: AbortController;
  /** Auto-reset sticky thread after repeated recovery replies. */
  private consecutiveFailures = 0;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.visitorId = '';
    this.siteId = '';
  }

  connectedCallback() {
    this.siteId = this.getAttribute('site-id') ?? '';
    this.visitorId = this.resolveVisitorId();
    this.render();
    this.bindEvents();
    void this.bootstrap();
  }

  private async bootstrap() {
    this.conversationId = this.loadConversationId();
    await this.loadWidgetConfig();
    void this.restoreSession();
    void this.reportContext('page_view');
    this.startIdleTracking();
  }

  private bindEvents() {
    this.shadow.querySelector('[data-launch]')?.addEventListener('click', () => this.setMinimized(false));
    this.shadow.querySelector('[data-minimize]')?.addEventListener('click', () => this.setMinimized(true));
    this.shadow.querySelector('[data-toggle]')?.addEventListener('click', () => this.toggle());
    this.shadow.querySelector('[data-escalate]')?.addEventListener('click', () => void this.escalateToHuman());
    this.shadow.querySelector('[data-new-chat]')?.addEventListener('click', () => this.startFreshConversation());
    this.shadow.querySelector('form')?.addEventListener('submit', (e) => this.onSubmit(e as SubmitEvent));
    const composer = this.shadow.querySelector('[data-composer]') as HTMLTextAreaElement | null;
    composer?.addEventListener('input', () => {
      this.lastActivityAt = Date.now();
      this.autoResizeComposer(composer);
    });
    composer?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (this.sending) return;
        this.shadow.querySelector('form')?.requestSubmit();
      }
    });
  }

  private autoResizeComposer(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  private composerEl(): HTMLTextAreaElement | null {
    return this.shadow.querySelector('[data-composer]') as HTMLTextAreaElement | null;
  }

  private setComposerEnabled(enabled: boolean, placeholder?: string) {
    const composer = this.composerEl();
    const submit = this.shadow.querySelector('button[type=submit]') as HTMLButtonElement | null;
    if (composer) {
      composer.disabled = !enabled;
      composer.placeholder =
        placeholder ??
        (enabled
          ? 'Ask anything… (Shift+Enter for new line)'
          : 'Chat handed off — use WhatsApp or wait for our team');
    }
    if (submit) submit.disabled = !enabled;
  }

  private isHumanMode(status = this.conversationStatus): boolean {
    return status === 'escalated' || status === 'human';
  }

  /** Sync UI + lock state when conversation status changes (queue / human / AI). */
  private applyConversationMode(status: string) {
    const prev = this.conversationStatus;
    this.conversationStatus = status;
    const human = this.isHumanMode(status);
    const resumedAi = this.isHumanMode(prev) && !human;

    this.aiLocked = human;

    const root = this.shadow.querySelector('.root');
    const banner = this.shadow.querySelector('[data-mode-banner]') as HTMLElement | null;
    const subtitle = this.shadow.querySelector('[data-subtitle]') as HTMLElement | null;
    const escalateBtn = this.shadow.querySelector('[data-escalate]') as HTMLButtonElement | null;
    const newChatBtn = this.shadow.querySelector('[data-new-chat]') as HTMLButtonElement | null;

    root?.classList.toggle('human-mode', human);
    root?.classList.toggle('queue-mode', status === 'escalated');
    root?.classList.toggle('live-human-mode', status === 'human');

    if (banner) {
      if (status === 'escalated') {
        banner.hidden = false;
        banner.dataset.mode = 'queue';
        banner.innerHTML =
          '<strong>Waiting for a team member</strong><span>You are in the queue. Messages still go to our team.</span>';
      } else if (status === 'human') {
        banner.hidden = false;
        banner.dataset.mode = 'human';
        banner.innerHTML =
          '<strong>Connected to a human</strong><span>A team member is in this chat with you.</span>';
      } else {
        banner.hidden = true;
        banner.dataset.mode = 'ai';
        banner.innerHTML = '';
      }
    }

    if (subtitle) {
      if (status === 'escalated') {
        subtitle.textContent = '● Waiting for human';
      } else if (status === 'human') {
        subtitle.textContent = '● Human agent';
      } else {
        const themeSub = this.widgetTheme.subtitle?.trim();
        subtitle.textContent = themeSub || '● Online';
      }
    }

    if (escalateBtn) {
      const escalationOff = this.widgetTheme.escalationEnabled === false;
      if (escalationOff) {
        escalateBtn.style.display = 'none';
      } else if (status === 'escalated') {
        escalateBtn.style.display = '';
        escalateBtn.disabled = true;
        escalateBtn.textContent = 'In queue';
        escalateBtn.title = 'Waiting for a team member';
      } else if (status === 'human') {
        escalateBtn.style.display = '';
        escalateBtn.disabled = true;
        escalateBtn.textContent = 'With human';
        escalateBtn.title = 'A team member is handling this chat';
      } else {
        escalateBtn.style.display = '';
        escalateBtn.disabled = false;
        escalateBtn.textContent = 'Human';
        escalateBtn.title = 'Talk to a human';
      }
    }

    if (newChatBtn) {
      newChatBtn.disabled = human || this.sending;
      newChatBtn.title = human
        ? 'Finish with the team member before starting a new chat'
        : 'Start a fresh AI conversation';
    }

    if (human) {
      this.setComposerEnabled(
        true,
        status === 'human'
          ? 'Message the team member…'
          : 'Message while you wait in queue…',
      );
      this.startHumanPolling();
    } else {
      this.setComposerEnabled(!this.sending);
      if (this.isHumanMode(prev)) {
        this.stopHumanPolling();
      }
      // Human → AI: drop sticky conversation so the next send cannot reuse a poisoned handoff thread.
      if (resumedAi) {
        this.beginFreshAiThread(
          'You are back with the AI assistant. Continuing in a fresh chat thread — send your message whenever you are ready.',
        );
      }
    }
  }

  private setMinimized(minimized: boolean) {
    this.minimized = minimized;
    const root = this.shadow.querySelector('.root');
    root?.classList.toggle('minimized', minimized);
    if (!minimized) {
      const composer = this.composerEl();
      composer?.focus();
    }
  }

  static get observedAttributes() {
    return ['site-id', 'visitor-id'];
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null) {
    if (name === 'site-id' && value) {
      this.siteId = value;
      if (!this.visitorId) {
        this.visitorId = this.resolveVisitorId();
      }
      this.conversationId = this.loadConversationId();
      void this.restoreSession();
    }
    if (name === 'visitor-id' && old !== value) {
      const prevAnonymous = this.anonymousVisitorId ?? this.visitorId;
      const next = value?.trim() || this.loadAnonymousVisitorId();
      if (next !== this.visitorId) {
        if (value?.trim() && prevAnonymous && prevAnonymous !== next) {
          void this.mergeVisitorIdentity(prevAnonymous, next);
        }
        this.visitorId = next;
        this.clearSessionForSite();
      }
    }
  }

  private async mergeVisitorIdentity(fromId: string, toId: string) {
    if (!this.siteId) return;
    try {
      await fetch(`${apiUrl()}/v1/chat/merge-visitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: this.siteId,
          fromVisitorId: fromId,
          toVisitorId: toId,
        }),
      });
    } catch {
      // non-fatal
    }
  }

  private async loadWidgetConfig() {
    if (!this.siteId) return;
    try {
      const res = await fetch(`${apiUrl()}/v1/widget/config?siteId=${this.siteId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { theme: WidgetTheme };
      this.widgetTheme = data.theme ?? {};
      this.applyTheme();
    } catch {
      // use defaults
    }
  }

  private applyTheme() {
    const t = this.widgetTheme;
    const primary = t.primaryColor ?? '#059669';
    const primaryDark = t.primaryColorDark ?? '#047857';
    const pos = t.position ?? 'bottom-right';

    this.style.setProperty('--nexus-primary', primary);
    this.style.setProperty('--nexus-primary-dark', primaryDark);

    if (pos === 'bottom-left') {
      this.style.left = '24px';
      this.style.right = 'auto';
    } else {
      this.style.right = '24px';
      this.style.left = 'auto';
    }

    const titleEl = this.shadow.querySelector('[data-title]');
    const statusEl = this.shadow.querySelector('[data-subtitle]');
    const escalateBtn = this.shadow.querySelector('[data-escalate]') as HTMLElement | null;
    if (titleEl) titleEl.textContent = t.title ?? 'Nexus Assistant';
    if (statusEl && !this.isHumanMode()) {
      statusEl.textContent = t.subtitle ?? '● Online';
    }
    if (escalateBtn) {
      if (t.escalationEnabled === false) {
        escalateBtn.style.display = 'none';
      } else if (!this.isHumanMode()) {
        escalateBtn.style.display = '';
        escalateBtn.removeAttribute('disabled');
        (escalateBtn as HTMLButtonElement).disabled = false;
        escalateBtn.textContent = 'Human';
      }
    }
  }

  private async reportContext(event = 'page_view') {
    if (!this.siteId || this.widgetTheme.proactiveEnabled === false) return;
    const idleSeconds = Math.floor((Date.now() - this.lastActivityAt) / 1000);
    try {
      const res = await fetch(`${apiUrl()}/v1/chat/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: this.siteId,
          visitorId: this.visitorId,
          pageUrl: window.location.href,
          pageTitle: document.title,
          idleSeconds,
          event,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { proactiveMessage?: string | null };
      if (data.proactiveMessage) {
        this.showProactiveMessage(data.proactiveMessage);
      }
    } catch {
      // non-fatal
    }
  }

  private showProactiveMessage(message: string) {
    if (this.messages.some((m) => m.role === 'system' && m.content === message)) return;
    this.setMinimized(false);
    this.addBubble(this.escape(message), 'system');
    this.messages.push({ role: 'system', content: message });
  }

  private startIdleTracking() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = setInterval(() => {
      const idleSeconds = Math.floor((Date.now() - this.lastActivityAt) / 1000);
      if (idleSeconds >= 60 && idleSeconds % 30 === 0) {
        void this.reportContext('idle');
      }
    }, 15000);
  }

  private startHumanPolling() {
    this.stopHumanPolling();
    void this.syncRenderedCountFromServer();
    this.humanPollTimer = setInterval(() => void this.pollHumanReplies(), 3000);
  }

  private stopHumanPolling() {
    if (this.humanPollTimer) {
      clearInterval(this.humanPollTimer);
      this.humanPollTimer = undefined;
    }
  }

  private abortInFlightChat() {
    if (this.chatAbort) {
      this.chatAbort.abort();
      this.chatAbort = undefined;
    }
  }

  /**
   * Drop the sticky conversation id so the next POST creates a new server thread.
   * Keeps visible history unless `clearUi` is true.
   */
  private beginFreshAiThread(notice?: string, clearUi = false) {
    this.abortInFlightChat();
    this.stopHumanPolling();
    this.consecutiveFailures = 0;

    const oldId = this.conversationId;
    if (this.siteId && oldId) {
      try {
        localStorage.removeItem(`nexus_messages_${this.siteId}_${oldId}`);
      } catch {
        // ignore
      }
    }
    if (this.siteId) localStorage.removeItem(this.conversationKey());
    this.conversationId = undefined;
    this.conversationStatus = 'open';
    this.aiLocked = false;

    if (clearUi) {
      this.messages = [];
      this.renderedMessageCount = 0;
      const msgs = this.shadow.querySelector('[data-msgs]');
      if (msgs) msgs.innerHTML = '';
    }

    if (notice) {
      const at = new Date().toISOString();
      this.addBubble(this.escape(notice), 'system', at);
      this.messages.push({ role: 'system', content: notice, createdAt: at });
    }

    this.renderedMessageCount = this.messages.length;

    // Update chrome without re-entering the human→AI resume path.
    const root = this.shadow.querySelector('.root');
    root?.classList.remove('human-mode', 'queue-mode', 'live-human-mode');
    const banner = this.shadow.querySelector('[data-mode-banner]') as HTMLElement | null;
    if (banner) {
      banner.hidden = true;
      banner.dataset.mode = 'ai';
      banner.innerHTML = '';
    }
    const subtitle = this.shadow.querySelector('[data-subtitle]') as HTMLElement | null;
    if (subtitle) {
      subtitle.textContent = this.widgetTheme.subtitle?.trim() || '● Online';
    }
    const escalateBtn = this.shadow.querySelector('[data-escalate]') as HTMLButtonElement | null;
    if (escalateBtn && this.widgetTheme.escalationEnabled !== false) {
      escalateBtn.style.display = '';
      escalateBtn.disabled = false;
      escalateBtn.textContent = 'Human';
      escalateBtn.title = 'Talk to a human';
    }
    const newChatBtn = this.shadow.querySelector('[data-new-chat]') as HTMLButtonElement | null;
    if (newChatBtn) {
      newChatBtn.disabled = this.sending;
      newChatBtn.title = 'Start a fresh AI conversation';
    }
    if (!this.sending) this.setComposerEnabled(true);
  }

  /** User-facing New chat control. */
  private startFreshConversation() {
    if (this.isHumanMode() || this.sending) return;
    this.beginFreshAiThread('Started a new chat.', true);
    this.composerEl()?.focus();
  }

  /** Align poll cursor with server history to avoid duplicate bubbles after AI SSE. */
  private async syncRenderedCountFromServer() {
    if (!this.siteId || !this.conversationId || !this.visitorId) return;
    try {
      const params = new URLSearchParams({
        siteId: this.siteId,
        visitorId: this.visitorId,
        conversationId: this.conversationId,
      });
      const res = await fetch(`${apiUrl()}/v1/chat/history?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as { messages: unknown[] };
      this.renderedMessageCount = data.messages.length;
    } catch {
      // ignore
    }
  }

  /**
   * When the browser drops a long SSE turn, the API may still have saved the real
   * assistant reply. Pull it from history so the visitor sees the answer.
   */
  private async tryRecoverReplyFromServer(
    userMessage: string,
    existingEl: HTMLElement | null,
  ): Promise<string | null> {
    if (!this.siteId || !this.conversationId || !this.visitorId) return null;

    for (const delayMs of [800, 2000, 4000]) {
      await new Promise((r) => setTimeout(r, delayMs));
      try {
        const params = new URLSearchParams({
          siteId: this.siteId,
          visitorId: this.visitorId,
          conversationId: this.conversationId,
        });
        const res = await fetch(`${apiUrl()}/v1/chat/history?${params}`);
        if (!res.ok) continue;
        const data = (await res.json()) as {
          messages: Array<{ role: string; content: string; createdAt?: string }>;
        };
        this.renderedMessageCount = data.messages.length;

        let lastUserIdx = -1;
        for (let i = data.messages.length - 1; i >= 0; i--) {
          if (
            data.messages[i].role === 'user' &&
            data.messages[i].content.trim() === userMessage.trim()
          ) {
            lastUserIdx = i;
            break;
          }
        }
        if (lastUserIdx < 0) continue;

        const after = data.messages.slice(lastUserIdx + 1);
        const assistant = [...after].reverse().find((m) => m.role === 'assistant');
        if (!assistant?.content) continue;
        if (RECOVERY_REPLY.test(assistant.content)) continue;

        if (existingEl) {
          this.setAssistantContent(existingEl, assistant.content, false);
        }
        return assistant.content;
      } catch {
        // retry
      }
    }
    return null;
  }

  private async pollHumanReplies() {
    if (!this.siteId || !this.conversationId) return;
    if (!this.isHumanMode()) {
      this.stopHumanPolling();
      return;
    }

    try {
      const params = new URLSearchParams({
        siteId: this.siteId,
        visitorId: this.visitorId,
        conversationId: this.conversationId,
      });
      const res = await fetch(`${apiUrl()}/v1/chat/history?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        status: string;
        messages: Array<{ role: string; content: string; createdAt?: string }>;
      };

      const previousStatus = this.conversationStatus;
      if (data.status !== previousStatus) {
        this.applyConversationMode(data.status);
      }

      // After AI resume, conversationId may already be cleared — stop without duplicating.
      if (!this.conversationId || !this.isHumanMode(data.status)) {
        this.stopHumanPolling();
        return;
      }

      if (data.messages.length > this.renderedMessageCount) {
        const newMsgs = data.messages.slice(this.renderedMessageCount);
        for (const m of newMsgs) {
          if (m.role === 'user') continue;
          this.messages.push({
            role: m.role as ChatMessage['role'],
            content: m.content,
            createdAt: m.createdAt,
          });
          this.renderStoredMessage(m.role, m.content, undefined, m.createdAt);
        }
        this.renderedMessageCount = data.messages.length;
        this.persistMessagesCache();
      }
    } catch {
      // ignore poll errors
    }
  }

  private async escalateToHuman() {
    if (!this.siteId || !this.conversationId) {
      this.addBubble('Send a message first, then we can connect you with our team.', 'system');
      return;
    }
    if (this.isHumanMode()) return;
    try {
      const res = await fetch(`${apiUrl()}/v1/chat/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: this.siteId,
          visitorId: this.visitorId,
          conversationId: this.conversationId,
        }),
      });
      if (res.ok) {
        this.applyConversationMode('escalated');
        await this.pollHumanReplies();
      }
    } catch {
      this.addBubble('Could not reach support right now. Please try again.', 'system');
    }
  }

  private resolveVisitorId(): string {
    const attr = this.getAttribute('visitor-id')?.trim();
    if (attr) return attr;
    return this.loadAnonymousVisitorId();
  }

  private loadAnonymousVisitorId(): string {
    const key = 'nexus_visitor_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    this.anonymousVisitorId = id;
    return id;
  }

  private conversationKey(): string {
    return `nexus_conversation_${this.siteId}`;
  }

  private messagesCacheKey(): string {
    return `nexus_messages_${this.siteId}_${this.conversationId}`;
  }

  private loadConversationId(): string | undefined {
    if (!this.siteId) return undefined;
    return localStorage.getItem(this.conversationKey()) ?? undefined;
  }

  private saveConversationId(id: string) {
    this.conversationId = id;
    if (this.siteId) localStorage.setItem(this.conversationKey(), id);
  }

  private clearSessionForSite() {
    this.abortInFlightChat();
    this.stopHumanPolling();
    this.sending = false;
    this.consecutiveFailures = 0;
    const oldId = this.conversationId;
    if (this.siteId && oldId) {
      try {
        localStorage.removeItem(`nexus_messages_${this.siteId}_${oldId}`);
      } catch {
        // ignore
      }
    }
    if (this.siteId) localStorage.removeItem(this.conversationKey());
    this.conversationId = undefined;
    this.messages = [];
    this.renderedMessageCount = 0;
    this.conversationStatus = 'open';
    this.aiLocked = false;
    const msgs = this.shadow.querySelector('[data-msgs]');
    if (msgs) msgs.innerHTML = '';
  }

  private persistMessagesCache() {
    if (!this.siteId || !this.conversationId || this.messages.length === 0) return;
    localStorage.setItem(this.messagesCacheKey(), JSON.stringify(this.messages));
  }

  private async restoreSession() {
    if (!this.siteId || !this.conversationId || !this.visitorId) return;

    const msgs = this.shadow.querySelector('[data-msgs]');
    if (msgs) msgs.innerHTML = '';
    this.messages = [];

    try {
      const params = new URLSearchParams({
        siteId: this.siteId,
        visitorId: this.visitorId,
        conversationId: this.conversationId,
      });
      const res = await fetch(`${apiUrl()}/v1/chat/history?${params}`);
      if (res.ok) {
        const data = (await res.json()) as {
          status: string;
          messages: Array<{
            role: string;
            content: string;
            createdAt?: string;
            meta?: Record<string, unknown>;
          }>;
        };
        this.conversationStatus = data.status;
        for (const m of data.messages) {
          this.messages.push({
            role: m.role as ChatMessage['role'],
            content: m.content,
            createdAt: m.createdAt,
            meta: m.meta,
          });
          this.renderStoredMessage(m.role, m.content, m.meta, m.createdAt);
        }
        this.renderedMessageCount = data.messages.length;
        this.applyConversationMode(data.status);

        // After human handoff + AI resume, never keep sending into that sticky thread —
        // even across page reloads.
        const resumedOnServer = data.messages.some(
          (m) => m.role === 'system' && /back with the AI assistant/i.test(m.content),
        );
        if (data.status === 'open' && resumedOnServer) {
          const oldId = this.conversationId;
          if (this.siteId && oldId) {
            try {
              localStorage.removeItem(`nexus_messages_${this.siteId}_${oldId}`);
            } catch {
              // ignore
            }
          }
          if (this.siteId) localStorage.removeItem(this.conversationKey());
          this.conversationId = undefined;
          this.consecutiveFailures = 0;
          const notice =
            'You are back with the AI assistant. Continuing in a fresh chat thread — send your message whenever you are ready.';
          const at = new Date().toISOString();
          this.addBubble(this.escape(notice), 'system', at);
          this.messages.push({ role: 'system', content: notice, createdAt: at });
          this.renderedMessageCount = this.messages.length;
        } else {
          this.persistMessagesCache();
        }
        return;
      }
    } catch {
      // fall through to local cache
    }

    this.restoreFromLocalCache();
  }

  private restoreFromLocalCache() {
    if (!this.conversationId) return;
    const raw = localStorage.getItem(this.messagesCacheKey());
    if (!raw) return;
    try {
      const cached = JSON.parse(raw) as ChatMessage[];
      for (const m of cached) {
        this.messages.push(m);
        this.renderStoredMessage(m.role, m.content, m.meta, m.createdAt);
      }
      this.renderedMessageCount = cached.length;
    } catch {
      localStorage.removeItem(this.messagesCacheKey());
    }
  }

  private renderStoredMessage(
    role: string,
    content: string,
    meta?: Record<string, unknown>,
    createdAt?: string,
  ) {
    if (role === 'user') {
      this.addBubble(this.escape(content), 'user', createdAt);
    } else if (role === 'assistant') {
      const el = this.addBubble('', 'assistant', createdAt);
      this.setAssistantContent(el, content, false);
      const sources = meta?.provenance as Array<Record<string, unknown>> | undefined;
      if (sources?.length) this.attachProvenance(el, sources);
    } else if (role === 'system') {
      this.addBubble(this.escape(content), 'system', createdAt);
    }
  }

  private attachProvenance(el: HTMLElement, sources: Array<Record<string, unknown>>) {
    const details = document.createElement('details');
    details.className = 'provenance';
    const summary = document.createElement('summary');
    summary.textContent = `Sources used (${sources.length})`;
    const list = document.createElement('ul');
    list.className = 'provenance-list';
    for (const s of sources) {
      const li = document.createElement('li');
      if (s.cached) li.classList.add('cached');
      const label = String(s.operationId ?? s.path ?? 'api');
      li.textContent = s.cached ? `${label} · cached` : label;
      list.appendChild(li);
    }
    details.append(summary, list);
    const timeEl = el.querySelector('.bubble-time');
    if (timeEl) el.insertBefore(details, timeEl);
    else el.appendChild(details);
  }

  private render() {
    this.shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: system-ui, sans-serif;
          font-size: 14px;
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483646;
        }
        .root { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
        .launcher {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, var(--nexus-primary, #059669), var(--nexus-primary-dark, #047857));
          color: white;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(5, 150, 105, 0.45);
          display: none;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .launcher:hover { transform: scale(1.05); box-shadow: 0 10px 28px rgba(5, 150, 105, 0.55); }
        .launcher svg { width: 26px; height: 26px; }
        .panel {
          width: 360px;
          max-width: calc(100vw - 48px);
          border: 1px solid #27272a;
          border-radius: 16px;
          overflow: hidden;
          background: #09090b;
          color: #fafafa;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
          display: flex;
          flex-direction: column;
          height: 520px;
          max-height: calc(100vh - 48px);
          transform-origin: bottom right;
          animation: panel-in 0.22s ease-out;
        }
        @keyframes panel-in {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .root.minimized .panel { display: none; }
        .root.minimized .launcher { display: flex; }
        header {
          padding: 12px 14px;
          background: #18181b;
          border-bottom: 1px solid #27272a;
          font-weight: 600;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .root.queue-mode header {
          background: #292524;
          border-bottom-color: #78350f;
        }
        .root.live-human-mode header {
          background: #1c1917;
          border-bottom-color: #b45309;
        }
        .root.human-mode .panel {
          border-color: #b45309;
          box-shadow: 0 20px 50px rgba(180, 83, 9, 0.25);
        }
        .mode-banner {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 10px 14px;
          font-size: 12px;
          line-height: 1.4;
          border-bottom: 1px solid #78350f;
          background: linear-gradient(90deg, #451a03, #292524);
          color: #fed7aa;
        }
        .mode-banner[hidden] { display: none !important; }
        .mode-banner strong {
          font-size: 12px;
          font-weight: 700;
          color: #fdba74;
        }
        .mode-banner span { color: #fdba74; opacity: 0.9; }
        .mode-banner[data-mode='human'] {
          background: linear-gradient(90deg, #7c2d12, #431407);
          border-bottom-color: #ea580c;
        }
        .mode-banner[data-mode='human'] strong,
        .mode-banner[data-mode='human'] span { color: #ffedd5; }
        .root.queue-mode .status { color: #fb923c; }
        .root.live-human-mode .status { color: #fdba74; }
        .header-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .icon-btn {
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #a1a1aa;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .icon-btn:hover { background: #27272a; color: #fafafa; }
        .icon-btn svg { width: 16px; height: 16px; }
        .status { font-size: 11px; color: #34d399; font-weight: 500; white-space: nowrap; }
        .msgs { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .bubble { max-width: 92%; padding: 10px 14px; border-radius: 12px; line-height: 1.5; word-break: break-word; }
        .bubble-body { display: block; }
        .bubble-time {
          display: block;
          margin-top: 6px;
          font-size: 10px;
          line-height: 1.2;
          opacity: 0.75;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .user { align-self: flex-end; background: var(--nexus-primary, #059669); color: white; border-bottom-right-radius: 4px; white-space: pre-wrap; }
        .user .bubble-time { color: rgba(255,255,255,0.75); }
        .assistant { align-self: flex-start; background: #27272a; border-bottom-left-radius: 4px; }
        .assistant .bubble-time { color: #71717a; text-align: left; }
        .system { align-self: center; background: #1e293b; color: #94a3b8; font-size: 12px; text-align: center; max-width: 95%; }
        .system .bubble-time { text-align: center; color: #64748b; }
        .assistant .md p { margin: 0 0 10px; }
        .assistant .md p:last-child { margin-bottom: 0; }
        .assistant .md h4, .assistant .md h5, .assistant .md h6 {
          margin: 0 0 8px;
          font-size: 14px;
          font-weight: 700;
          color: #fafafa;
        }
        .assistant .md ol, .assistant .md ul {
          margin: 8px 0 10px;
          padding-left: 1.25rem;
        }
        .assistant .md li { margin: 6px 0; padding-left: 2px; }
        .assistant .md li::marker { color: #34d399; }
        .assistant .md strong { font-weight: 600; color: #fafafa; }
        .assistant .md em { color: #d4d4d8; }
        .assistant .md code {
          font-family: ui-monospace, monospace;
          font-size: 12px;
          background: #18181b;
          padding: 1px 5px;
          border-radius: 4px;
          color: #34d399;
        }
        .assistant .md a {
          color: #34d399;
          text-decoration: underline;
          text-underline-offset: 2px;
          font-weight: 500;
          cursor: pointer;
        }
        .assistant .md a:hover { color: #6ee7b7; }
        .assistant .md.streaming { white-space: pre-wrap; }
        .approval { border: 1px solid #d97706; background: #451a03; padding: 10px; border-radius: 8px; align-self: flex-start; max-width: 90%; }
        .approval p { margin: 0 0 8px; font-size: 13px; }
        .approval button { margin-right: 6px; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; }
        .confirm { background: #059669; color: white; }
        .decline { background: #3f3f46; color: #fafafa; }
        .undo { align-self: flex-start; font-size: 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .undo button { background: #27272a; border: 1px solid #52525b; color: #fafafa; padding: 4px 10px; border-radius: 6px; cursor: pointer; }
        .provenance {
          margin-top: 8px;
          border-top: 1px solid #27272a;
          padding-top: 6px;
        }
        .provenance summary {
          cursor: pointer;
          color: #71717a;
          font-size: 11px;
          list-style: none;
        }
        .provenance summary::-webkit-details-marker { display: none; }
        .provenance-list {
          margin: 6px 0 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .provenance-list li {
          font-size: 10px;
          font-family: ui-monospace, monospace;
          border: 1px solid #3f3f46;
          background: #18181b;
          color: #a1a1aa;
          border-radius: 999px;
          padding: 2px 8px;
        }
        .provenance-list li.cached { border-color: #05966955; color: #34d399; }
        .dry-run {
          margin: 8px 0;
          padding: 8px;
          border-radius: 6px;
          background: #18181b;
          border: 1px solid #3f3f46;
          font-family: ui-monospace, monospace;
          font-size: 11px;
          color: #d4d4d8;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .mission {
          align-self: flex-start;
          max-width: 90%;
          border: 1px solid #334155;
          background: #0f172a;
          border-radius: 8px;
          padding: 10px 12px;
        }
        .mission h4 { margin: 0 0 8px; font-size: 13px; color: #e2e8f0; }
        .mission ol { margin: 0; padding-left: 18px; color: #94a3b8; font-size: 12px; }
        .mission li { margin: 4px 0; }
        .mission li.done { color: #34d399; }
        .mission li.active { color: #fbbf24; }
        .mission li.pending { color: #64748b; }
        footer { border-top: 1px solid #27272a; padding: 10px; display: flex; gap: 8px; flex-direction: column; }
        form { display: flex; gap: 8px; align-items: flex-end; }
        textarea[data-composer] {
          flex: 1;
          border: 1px solid #3f3f46;
          background: #18181b;
          color: #fafafa;
          border-radius: 8px;
          padding: 8px 10px;
          outline: none;
          resize: none;
          min-height: 44px;
          max-height: 120px;
          line-height: 1.45;
          font-family: inherit;
          font-size: 14px;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;
          overflow-x: hidden;
          overflow-y: auto;
          field-sizing: content;
        }
        textarea[data-composer]:focus { border-color: var(--nexus-primary, #059669); }
        textarea[data-composer]:disabled { opacity: 0.65; cursor: not-allowed; }
        button[type=submit] { background: var(--nexus-primary, #059669); color: white; border: none; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-weight: 600; flex-shrink: 0; }
        button[type=submit]:disabled { opacity: 0.5; cursor: not-allowed; }
        .whatsapp-card {
          align-self: center;
          max-width: 95%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid #059669;
          background: #052e1f;
          text-align: center;
        }
        .whatsapp-card p { margin: 0 0 10px; font-size: 13px; line-height: 1.5; color: #d1fae5; }
        .whatsapp-btn {
          display: inline-block;
          padding: 8px 14px;
          border-radius: 8px;
          background: #25d366;
          color: #052e1f;
          font-weight: 700;
          font-size: 13px;
          text-decoration: none;
        }
        .whatsapp-btn:hover { filter: brightness(1.05); }
        .escalate-btn {
          font-size: 10px;
          color: #a1a1aa;
          background: none;
          border: 1px solid #3f3f46;
          border-radius: 6px;
          padding: 4px 8px;
          cursor: pointer;
        }
        .escalate-btn:hover:not(:disabled) { color: #fafafa; border-color: #52525b; }
        .escalate-btn:disabled {
          cursor: default;
          opacity: 1;
          color: #fdba74;
          border-color: #b45309;
          background: rgba(180, 83, 9, 0.2);
        }
        .new-chat-btn {
          font-size: 10px;
          color: #a1a1aa;
          background: none;
          border: 1px solid #3f3f46;
          border-radius: 6px;
          padding: 4px 8px;
          cursor: pointer;
        }
        .new-chat-btn:hover:not(:disabled) { color: #fafafa; border-color: #52525b; }
        .new-chat-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .root.live-human-mode .escalate-btn:disabled {
          color: #ffedd5;
          border-color: #ea580c;
          background: rgba(234, 88, 12, 0.25);
        }
        .trace-toggle { font-size: 11px; color: #71717a; background: none; border: none; cursor: pointer; text-align: left; padding: 0; }
        .trace { font-size: 10px; font-family: monospace; color: #71717a; max-height: 80px; overflow-y: auto; background: #18181b; padding: 6px; border-radius: 6px; display: none; }
        .trace.open { display: block; }
        .typing {
          align-self: flex-start;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #27272a;
          border-radius: 12px;
          border-bottom-left-radius: 4px;
          max-width: 85%;
        }
        .typing-dots { display: flex; gap: 4px; }
        .typing-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #71717a;
          animation: bounce 1.2s infinite ease-in-out;
        }
        .typing-dots span:nth-child(2) { animation-delay: 0.15s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .typing-label { font-size: 12px; color: #a1a1aa; }
      </style>
      <div class="root minimized">
        <button type="button" class="launcher" data-launch aria-label="Open chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <div class="panel">
          <header>
            <div class="header-left">
              <span data-title>Nexus Assistant</span>
              <span class="status" data-subtitle>● Online</span>
            </div>
            <div class="header-actions">
              <button type="button" class="new-chat-btn" data-new-chat title="Start a fresh AI conversation">New</button>
              <button type="button" class="escalate-btn" data-escalate>Human</button>
              <button type="button" class="icon-btn" data-minimize aria-label="Minimize chat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <path d="M5 12h14"/>
                </svg>
              </button>
            </div>
          </header>
          <div class="mode-banner" data-mode-banner hidden></div>
          <div class="msgs" data-msgs></div>
          <footer>
            <button type="button" class="trace-toggle" data-toggle>See how this was handled</button>
            <div class="trace" data-trace></div>
            <form>
              <textarea data-composer rows="2" placeholder="Ask anything… (Shift+Enter for new line)" autocomplete="off" required></textarea>
              <button type="submit">Send</button>
            </form>
          </footer>
        </div>
      </div>
    `;
  }

  private msgsEl() {
    return this.shadow.querySelector('[data-msgs]')!;
  }

  private showTyping(label = 'Thinking…') {
    this.hideTyping();
    const el = document.createElement('div');
    el.className = 'typing';
    el.dataset.typing = '1';
    el.innerHTML = `
      <div class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></div>
      <span class="typing-label">${this.escape(label)}</span>
    `;
    this.msgsEl().appendChild(el);
    this.msgsEl().scrollTop = this.msgsEl().scrollHeight;
  }

  private updateTyping(label: string) {
    const el = this.shadow.querySelector('[data-typing] .typing-label');
    if (el) el.textContent = label;
  }

  private hideTyping() {
    this.shadow.querySelector('[data-typing]')?.remove();
  }

  private formatChatTime(iso?: string): string {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(d);
    } catch {
      return d.toLocaleString();
    }
  }

  private setAssistantContent(el: HTMLElement, text: string, streaming: boolean) {
    const timeEl = el.querySelector('.bubble-time');
    const timeHtml = timeEl?.outerHTML ?? '';
    if (streaming) {
      el.innerHTML = `<div class="bubble-body md streaming">${streamingPlainText(text)}</div>${timeHtml}`;
    } else {
      el.innerHTML = `<div class="bubble-body md">${renderMarkdown(text)}</div>${timeHtml}`;
    }
    this.msgsEl().scrollTop = this.msgsEl().scrollHeight;
  }

  private addBubble(html: string, className: string, createdAt?: string) {
    const el = document.createElement('div');
    el.className = `bubble ${className}`;
    const timeLabel = this.formatChatTime(createdAt);
    el.innerHTML = `<div class="bubble-body">${html}</div>${
      timeLabel ? `<time class="bubble-time" datetime="${this.escapeAttr(createdAt || new Date().toISOString())}">${this.escape(timeLabel)}</time>` : ''
    }`;
    this.msgsEl().appendChild(el);
    this.msgsEl().scrollTop = this.msgsEl().scrollHeight;
    return el;
  }

  private toggle() {
    this.showTrace = !this.showTrace;
    const traceEl = this.shadow.querySelector('[data-trace]')!;
    traceEl.classList.toggle('open', this.showTrace);
    if (this.showTrace) {
      traceEl.textContent = this.trace.map((t) => `[${t.type}] ${t.agent ?? ''} ${t.detail ?? ''}`).join('\n') || 'No trace yet';
    }
  }

  private renderGuardrailCard(payload: Record<string, unknown>) {
    const message = String(payload.message ?? '');
    const whatsappUrl = payload.whatsappUrl ? String(payload.whatsappUrl) : '';
    const card = document.createElement('div');
    card.className = 'whatsapp-card';
    card.innerHTML = `
      <p>${this.escape(message)}</p>
      ${whatsappUrl ? `<a class="whatsapp-btn" href="${this.escapeAttr(whatsappUrl)}" target="_blank" rel="noopener noreferrer">Continue on WhatsApp</a>` : ''}
    `;
    this.msgsEl().appendChild(card);
    this.msgsEl().scrollTop = this.msgsEl().scrollHeight;
  }

  private escapeAttr(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private applyGuardrailHandoff(payload: Record<string, unknown>) {
    this.renderGuardrailCard(payload);
    this.applyConversationMode('escalated');
  }

  private async onSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (this.sending) return;

    const form = e.target as HTMLFormElement;
    const composer = form.querySelector('[data-composer]') as HTMLTextAreaElement;
    const text = composer.value.trim();
    if (!text || !this.siteId) return;

    if (this.aiLocked && !this.isHumanMode()) {
      this.applyConversationMode(this.conversationStatus || 'open');
    }

    if (this.aiLocked && !this.isHumanMode()) {
      return;
    }

    this.sending = true;
    this.abortInFlightChat();
    const abort = new AbortController();
    this.chatAbort = abort;

    composer.value = '';
    composer.style.height = 'auto';
    composer.disabled = true;
    const submitBtn = form.querySelector('button[type=submit]') as HTMLButtonElement;
    if (submitBtn) submitBtn.disabled = true;
    const newChatBtn = this.shadow.querySelector('[data-new-chat]') as HTMLButtonElement | null;
    if (newChatBtn) newChatBtn.disabled = true;

    const sentAt = new Date().toISOString();
    this.messages.push({ role: 'user', content: text, createdAt: sentAt });
    this.addBubble(this.escape(text), 'user', sentAt);
    this.persistMessagesCache();
    this.showTyping();

    let assistantEl: HTMLElement | null = null;
    let assistantText = '';
    let pendingProvenance: Array<Record<string, unknown>> | null = null;
    let assistantCreatedAt = '';
    let forceFreshAfterErrors = false;

    try {
      const body: Record<string, string> = {
        siteId: this.siteId,
        visitorId: this.visitorId,
        message: text,
      };
      if (this.conversationId) {
        body.conversationId = this.conversationId;
      }

      const res = await fetch(`${apiUrl()}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) throw new Error('Chat request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(line.slice(6)) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (payload.type === 'conversation') {
            this.saveConversationId(payload.conversationId as string);
            this.persistMessagesCache();
          } else if (payload.type === 'status') {
            this.updateTyping(String(payload.label ?? payload.phase ?? 'Working…'));
          } else if (payload.type === 'handoff') {
            this.hideTyping();
            this.addBubble(this.escape(String(payload.label)), 'system');
            this.messages.push({
              role: 'system',
              content: String(payload.label),
              createdAt: new Date().toISOString(),
            });
          } else if (payload.type === 'token') {
            if (!assistantEl) {
              this.hideTyping();
              assistantCreatedAt = new Date().toISOString();
              assistantEl = this.addBubble('', 'assistant', assistantCreatedAt);
            }
            assistantText += String(payload.content);
            this.setAssistantContent(assistantEl, assistantText, true);
          } else if (payload.type === 'approval_card') {
            this.renderApproval(payload);
          } else if (payload.type === 'undo_available') {
            this.renderUndo(payload);
          } else if (payload.type === 'mission_plan') {
            this.renderMissionPlan(payload);
          } else if (payload.type === 'provenance') {
            pendingProvenance = (payload.sources as Array<Record<string, unknown>>) ?? [];
          } else if (payload.type === 'trace') {
            this.trace = payload.steps as TraceStep[];
          } else if (payload.type === 'error') {
            this.hideTyping();
            const raw = String(payload.message ?? 'Something went wrong');
            const friendly =
              raw === 'fetch failed' || /ECONNREFUSED|unreachable/i.test(raw)
                ? 'Sorry — I could not finish that just now. Please try again in a moment.'
                : raw;
            if (!assistantEl) {
              assistantCreatedAt = new Date().toISOString();
              assistantEl = this.addBubble('', 'assistant', assistantCreatedAt);
            }
            assistantText = friendly;
            this.setAssistantContent(assistantEl, assistantText, false);
          } else if (payload.type === 'guardrail') {
            this.hideTyping();
            this.applyGuardrailHandoff(payload);
          } else if (payload.type === 'done') {
            if (assistantEl && assistantText) {
              this.setAssistantContent(assistantEl, assistantText, false);
              if (pendingProvenance?.length) {
                this.attachProvenance(assistantEl, pendingProvenance);
              }
            }
          }
        }
      }

      if (assistantText) {
        this.messages.push({
          role: 'assistant',
          content: assistantText,
          createdAt: assistantCreatedAt || new Date().toISOString(),
          meta: pendingProvenance?.length ? { provenance: pendingProvenance } : undefined,
        });
        if (assistantEl) {
          this.setAssistantContent(assistantEl, assistantText, false);
          if (pendingProvenance?.length && !assistantEl.querySelector('.provenance')) {
            this.attachProvenance(assistantEl, pendingProvenance);
          }
        }

        if (RECOVERY_REPLY.test(assistantText)) {
          this.consecutiveFailures += 1;
          const recovered = await this.tryRecoverReplyFromServer(text, assistantEl);
          if (recovered) {
            assistantText = recovered;
            this.consecutiveFailures = 0;
            // Replace last assistant message in local cache
            for (let i = this.messages.length - 1; i >= 0; i--) {
              if (this.messages[i].role === 'assistant') {
                this.messages[i] = {
                  ...this.messages[i],
                  content: recovered,
                };
                break;
              }
            }
          } else if (this.consecutiveFailures >= 2) {
            forceFreshAfterErrors = true;
          }
        } else {
          this.consecutiveFailures = 0;
        }
      } else {
        // Stream ended with no tokens — server may still have saved a reply.
        const recovered = await this.tryRecoverReplyFromServer(text, null);
        if (recovered) {
          assistantText = recovered;
          const at = new Date().toISOString();
          assistantEl = this.addBubble('', 'assistant', at);
          this.setAssistantContent(assistantEl, recovered, false);
          this.messages.push({ role: 'assistant', content: recovered, createdAt: at });
          this.consecutiveFailures = 0;
        }
      }
      this.persistMessagesCache();
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      if (!aborted) {
        this.hideTyping();
        // Prefer server-persisted reply over a local connection error bubble.
        const recovered = await this.tryRecoverReplyFromServer(text, null);
        if (recovered) {
          const at = new Date().toISOString();
          const el = this.addBubble('', 'assistant', at);
          this.setAssistantContent(el, recovered, false);
          this.messages.push({ role: 'assistant', content: recovered, createdAt: at });
          this.persistMessagesCache();
          this.consecutiveFailures = 0;
        } else {
          const recovery =
            'Sorry — connection issue. Please try sending your message again.';
          const at = new Date().toISOString();
          this.addBubble(this.escape(recovery), 'assistant', at);
          this.messages.push({ role: 'assistant', content: recovery, createdAt: at });
          this.persistMessagesCache();
          this.consecutiveFailures += 1;
          if (this.consecutiveFailures >= 2) forceFreshAfterErrors = true;
        }
      }
    } finally {
      if (this.chatAbort === abort) this.chatAbort = undefined;
      this.sending = false;
      this.hideTyping();
      if (forceFreshAfterErrors) {
        this.beginFreshAiThread(
          'This chat hit repeated errors, so a fresh thread was started. Please send your message again.',
          false,
        );
      } else {
        this.applyConversationMode(this.conversationStatus);
      }
      this.composerEl()?.focus();
    }
  }

  private renderApproval(payload: Record<string, unknown>) {
    const el = document.createElement('div');
    el.className = 'approval';
    const dryRun = payload.dryRun as Record<string, unknown> | undefined;
    const dryRunHtml = dryRun
      ? `<div class="dry-run">${this.escape(String(dryRun.method))} ${this.escape(String(dryRun.path))}\n${this.escape(JSON.stringify(dryRun.payload ?? {}, null, 2))}</div>`
      : '';
    el.innerHTML = `<p><strong>Approval required</strong><br/>${this.escape(String(payload.summary))}</p>
      <p style="font-size:11px;color:#a1a1aa;margin:0 0 6px;">Risk: ${this.escape(String(payload.riskTier ?? 'write'))}</p>
      ${dryRunHtml}`;
    const confirm = document.createElement('button');
    confirm.className = 'confirm';
    confirm.textContent = 'Confirm action';
    const decline = document.createElement('button');
    decline.className = 'decline';
    decline.textContent = 'Decline';
    confirm.onclick = async () => {
      await fetch(`${apiUrl()}/v1/chat/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: payload.token }),
      });
      el.remove();
      this.addBubble('Action confirmed and executed.', 'system');
    };
    decline.onclick = () => {
      el.remove();
      this.addBubble('Action declined. Nothing was changed.', 'system');
    };
    el.append(confirm, decline);
    this.msgsEl().appendChild(el);
  }

  private renderUndo(payload: Record<string, unknown>) {
    const el = document.createElement('div');
    el.className = 'undo';
    const deadline = new Date(String(payload.undoDeadline));
    const btn = document.createElement('button');
    btn.textContent = 'Undo';
    btn.onclick = async () => {
      const res = await fetch(`${apiUrl()}/v1/chat/undo/${payload.executionId}`, { method: 'POST' });
      el.remove();
      this.addBubble(res.ok ? 'Action undone.' : 'Could not undo this action.', 'system');
    };
    const label = document.createElement('span');
    label.style.color = '#a1a1aa';
    label.textContent = String(payload.summary ?? 'Undo available');
    const timer = document.createElement('span');
    timer.style.color = '#a1a1aa';
    const interval = setInterval(() => {
      const sec = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000));
      timer.textContent = `${sec}s left`;
      if (sec <= 0) {
        clearInterval(interval);
        el.remove();
      }
    }, 1000);
    el.append(btn, label, timer);
    this.msgsEl().appendChild(el);
  }

  private renderMissionPlan(payload: Record<string, unknown>) {
    const el = document.createElement('div');
    el.className = 'mission';
    const steps = (payload.steps as Array<Record<string, unknown>>) ?? [];
    const current = Number(payload.currentStep ?? 0);
    const title = String(payload.title ?? 'Action plan');
    const items = steps
      .map((s, i) => {
        const cls = i < current ? 'done' : i === current ? 'active' : 'pending';
        const label = String(s.label ?? s.operationId ?? `Step ${i + 1}`);
        return `<li class="${cls}">${this.escape(label)}</li>`;
      })
      .join('');
    el.innerHTML = `<h4>${this.escape(title)}</h4><ol>${items}</ol>`;
    this.msgsEl().appendChild(el);
    this.msgsEl().scrollTop = this.msgsEl().scrollHeight;
  }

  private escape(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

if (!customElements.get('nexus-chat')) {
  customElements.define('nexus-chat', NexusChatElement);
}
