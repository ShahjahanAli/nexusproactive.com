import { renderMarkdown, streamingPlainText } from './formatMessage';

const API_URL = (typeof window !== 'undefined' && (window as unknown as { NEXUS_API_URL?: string }).NEXUS_API_URL)
  || 'http://localhost:5000';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  meta?: Record<string, unknown>;
}

interface TraceStep {
  type: string;
  agent?: string;
  detail?: string;
  timestamp: string;
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

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.visitorId = '';
    this.siteId = '';
  }

  connectedCallback() {
    this.siteId = this.getAttribute('site-id') ?? '';
    this.visitorId = this.resolveVisitorId();
    this.conversationId = this.loadConversationId();
    this.render();
    this.bindEvents();
    void this.restoreSession();
  }

  private bindEvents() {
    this.shadow.querySelector('[data-launch]')?.addEventListener('click', () => this.setMinimized(false));
    this.shadow.querySelector('[data-minimize]')?.addEventListener('click', () => this.setMinimized(true));
    this.shadow.querySelector('[data-toggle]')?.addEventListener('click', () => this.toggle());
    this.shadow.querySelector('form')?.addEventListener('submit', (e) => this.onSubmit(e as SubmitEvent));
  }

  private setMinimized(minimized: boolean) {
    this.minimized = minimized;
    const root = this.shadow.querySelector('.root');
    root?.classList.toggle('minimized', minimized);
    if (!minimized) {
      const input = this.shadow.querySelector('input') as HTMLInputElement | null;
      input?.focus();
    }
  }

  static get observedAttributes() {
    return ['site-id', 'visitor-id'];
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null) {
    if (name === 'site-id' && value) {
      this.siteId = value;
      this.conversationId = this.loadConversationId();
      void this.restoreSession();
    }
    if (name === 'visitor-id' && old !== value) {
      const next = value?.trim() || this.loadAnonymousVisitorId();
      if (next !== this.visitorId) {
        this.visitorId = next;
        this.clearSessionForSite();
      }
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
    if (this.siteId) localStorage.removeItem(this.conversationKey());
    this.conversationId = undefined;
    this.messages = [];
    const msgs = this.shadow.querySelector('[data-msgs]');
    if (msgs) msgs.innerHTML = '';
  }

  private persistMessagesCache() {
    if (!this.siteId || !this.conversationId || this.messages.length === 0) return;
    localStorage.setItem(this.messagesCacheKey(), JSON.stringify(this.messages));
  }

  private async restoreSession() {
    if (!this.siteId || !this.conversationId) return;

    const msgs = this.shadow.querySelector('[data-msgs]');
    if (msgs) msgs.innerHTML = '';
    this.messages = [];

    try {
      const params = new URLSearchParams({
        siteId: this.siteId,
        visitorId: this.visitorId,
        conversationId: this.conversationId,
      });
      const res = await fetch(`${API_URL}/v1/chat/history?${params}`);
      if (res.ok) {
        const data = (await res.json()) as {
          messages: Array<{ role: string; content: string }>;
        };
        for (const m of data.messages) {
          this.messages.push({ role: m.role as ChatMessage['role'], content: m.content });
          this.renderStoredMessage(m.role, m.content);
        }
        this.persistMessagesCache();
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
        this.renderStoredMessage(m.role, m.content);
      }
    } catch {
      localStorage.removeItem(this.messagesCacheKey());
    }
  }

  private renderStoredMessage(role: string, content: string) {
    if (role === 'user') {
      this.addBubble(this.escape(content), 'user');
    } else if (role === 'assistant') {
      const el = this.addBubble('', 'assistant');
      this.setAssistantContent(el, content, false);
    } else if (role === 'system') {
      this.addBubble(this.escape(content), 'system');
    }
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
          background: linear-gradient(135deg, #059669, #047857);
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
        }
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
        .user { align-self: flex-end; background: #059669; color: white; border-bottom-right-radius: 4px; }
        .assistant { align-self: flex-start; background: #27272a; border-bottom-left-radius: 4px; }
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
        .assistant .md a { color: #34d399; text-decoration: underline; }
        .assistant .md.streaming { white-space: pre-wrap; }
        .system { align-self: center; background: #1e293b; color: #94a3b8; font-size: 12px; text-align: center; max-width: 95%; }
        .approval { border: 1px solid #d97706; background: #451a03; padding: 10px; border-radius: 8px; align-self: flex-start; max-width: 90%; }
        .approval p { margin: 0 0 8px; font-size: 13px; }
        .approval button { margin-right: 6px; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; }
        .confirm { background: #059669; color: white; }
        .decline { background: #3f3f46; color: #fafafa; }
        .undo { align-self: flex-start; font-size: 12px; }
        .undo button { background: #27272a; border: 1px solid #52525b; color: #fafafa; padding: 4px 10px; border-radius: 6px; cursor: pointer; }
        footer { border-top: 1px solid #27272a; padding: 10px; display: flex; gap: 8px; flex-direction: column; }
        form { display: flex; gap: 8px; }
        input { flex: 1; border: 1px solid #3f3f46; background: #18181b; color: #fafafa; border-radius: 8px; padding: 8px 10px; outline: none; }
        input:focus { border-color: #059669; }
        button[type=submit] { background: #059669; color: white; border: none; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-weight: 600; }
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
              <span>Nexus Assistant</span>
              <span class="status">● Online</span>
            </div>
            <div class="header-actions">
              <button type="button" class="icon-btn" data-minimize aria-label="Minimize chat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <path d="M5 12h14"/>
                </svg>
              </button>
            </div>
          </header>
          <div class="msgs" data-msgs></div>
          <footer>
            <button type="button" class="trace-toggle" data-toggle>See how this was handled</button>
            <div class="trace" data-trace></div>
            <form>
              <input type="text" placeholder="Ask anything…" autocomplete="off" required />
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

  private setAssistantContent(el: HTMLElement, text: string, streaming: boolean) {
    if (streaming) {
      el.innerHTML = `<div class="md streaming">${streamingPlainText(text)}</div>`;
    } else {
      el.innerHTML = `<div class="md">${renderMarkdown(text)}</div>`;
    }
    this.msgsEl().scrollTop = this.msgsEl().scrollHeight;
  }

  private addBubble(html: string, className: string) {
    const el = document.createElement('div');
    el.className = `bubble ${className}`;
    el.innerHTML = html;
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

  private async onSubmit(e: SubmitEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    const text = input.value.trim();
    if (!text || !this.siteId) return;
    input.value = '';
    input.disabled = true;

    this.messages.push({ role: 'user', content: text });
    this.addBubble(this.escape(text), 'user');
    this.persistMessagesCache();
    this.showTyping();

    let assistantEl: HTMLElement | null = null;
    let assistantText = '';

    try {
      const res = await fetch(`${API_URL}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: this.siteId,
          visitorId: this.visitorId,
          message: text,
          conversationId: this.conversationId,
        }),
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
          const payload = JSON.parse(line.slice(6)) as Record<string, unknown>;

          if (payload.type === 'conversation') {
            this.saveConversationId(payload.conversationId as string);
            this.persistMessagesCache();
          } else if (payload.type === 'status') {
            this.updateTyping(String(payload.label ?? payload.phase ?? 'Working…'));
          } else if (payload.type === 'handoff') {
            this.hideTyping();
            this.addBubble(this.escape(String(payload.label)), 'system');
          } else if (payload.type === 'token') {
            if (!assistantEl) {
              this.hideTyping();
              assistantEl = this.addBubble('', 'assistant');
            }
            assistantText += String(payload.content);
            this.setAssistantContent(assistantEl, assistantText, true);
          } else if (payload.type === 'approval_card') {
            this.renderApproval(payload);
          } else if (payload.type === 'undo_available') {
            this.renderUndo(payload);
          } else if (payload.type === 'trace') {
            this.trace = payload.steps as TraceStep[];
          } else if (payload.type === 'error') {
            this.hideTyping();
            this.addBubble(this.escape(String(payload.message)), 'system');
          } else if (payload.type === 'done') {
            if (assistantEl && assistantText) {
              this.setAssistantContent(assistantEl, assistantText, false);
            }
          }
        }
      }

      if (assistantText) {
        this.messages.push({ role: 'assistant', content: assistantText });
        if (assistantEl) {
          this.setAssistantContent(assistantEl, assistantText, false);
        }
      }
      this.persistMessagesCache();
    } catch (err) {
      this.hideTyping();
      this.addBubble('Connection error. Please try again.', 'system');
    }

    this.hideTyping();

    input.disabled = false;
    input.focus();
  }

  private renderApproval(payload: Record<string, unknown>) {
    const el = document.createElement('div');
    el.className = 'approval';
    el.innerHTML = `<p><strong>Approval required</strong><br/>${this.escape(String(payload.summary))}</p>`;
    const confirm = document.createElement('button');
    confirm.className = 'confirm';
    confirm.textContent = 'Confirm';
    const decline = document.createElement('button');
    decline.className = 'decline';
    decline.textContent = 'Decline';
    confirm.onclick = async () => {
      await fetch(`${API_URL}/v1/chat/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: payload.token }),
      });
      el.remove();
      this.addBubble('Action confirmed and executed.', 'system');
    };
    decline.onclick = () => el.remove();
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
      await fetch(`${API_URL}/v1/chat/undo/${payload.executionId}`, { method: 'POST' });
      el.remove();
      this.addBubble('Action undone.', 'system');
    };
    const timer = document.createElement('span');
    timer.style.marginLeft = '8px';
    timer.style.color = '#a1a1aa';
    const interval = setInterval(() => {
      const sec = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000));
      timer.textContent = `${sec}s`;
      if (sec <= 0) { clearInterval(interval); el.remove(); }
    }, 1000);
    el.append(btn, timer);
    this.msgsEl().appendChild(el);
  }

  private escape(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

if (!customElements.get('nexus-chat')) {
  customElements.define('nexus-chat', NexusChatElement);
}
