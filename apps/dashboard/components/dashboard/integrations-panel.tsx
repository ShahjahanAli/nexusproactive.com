'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { Button, Input } from '@/components/dashboard/ui/button';
import { Badge } from '@/components/dashboard/ui/badge';

interface WebhookSub {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret: string;
  created_at: string;
}

interface SiteOption {
  id: string;
  name: string;
}

interface TriggerRow {
  id: string;
  name: string;
  trigger_type: string;
  conditions: Record<string, unknown>;
  message_template: string;
  is_active: boolean;
}

const WEBHOOK_EVENTS = [
  'conversation.started',
  'message.user',
  'message.assistant',
  'escalation.requested',
  'escalation.claimed',
  'escalation.resolved',
  'action.executed',
  'proactive.triggered',
];

export function IntegrationsPanel({
  webhooks,
  sites,
  initialTriggers,
}: {
  webhooks: WebhookSub[];
  sites: SiteOption[];
  initialTriggers: TriggerRow[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['escalation.requested', 'message.user']);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [triggerName, setTriggerName] = useState('');
  const [triggerType, setTriggerType] = useState<'page_view' | 'idle' | 'custom_event'>('idle');
  const [pathPattern, setPathPattern] = useState('/checkout*');
  const [idleSeconds, setIdleSeconds] = useState('90');
  const [messageTemplate, setMessageTemplate] = useState(
    'Need help? I can answer questions or connect you with our team.',
  );
  const [triggers, setTriggers] = useState(initialTriggers);
  const [loading, setLoading] = useState(false);

  async function addWebhook(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, events }),
    });
    setUrl('');
    setLoading(false);
    router.refresh();
  }

  async function deleteWebhook(id: string) {
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  async function loadTriggers(nextSiteId: string) {
    setSiteId(nextSiteId);
    const res = await fetch(`/api/proactive/sites/${nextSiteId}/triggers`);
    const data = (await res.json()) as { triggers: TriggerRow[] };
    setTriggers(data.triggers ?? []);
  }

  async function addTrigger(e: FormEvent) {
    e.preventDefault();
    if (!siteId) return;
    setLoading(true);
    const conditions =
      triggerType === 'page_view'
        ? { pathPattern }
        : triggerType === 'idle'
          ? { minIdleSeconds: Number(idleSeconds) }
          : { eventName: 'cart_abandoned' };

    await fetch(`/api/proactive/sites/${siteId}/triggers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: triggerName,
        triggerType,
        conditions,
        messageTemplate,
      }),
    });
    setTriggerName('');
    setLoading(false);
    await loadTriggers(siteId);
  }

  async function deleteTrigger(triggerId: string) {
    if (!siteId) return;
    await fetch(`/api/proactive/sites/${siteId}/triggers/${triggerId}`, { method: 'DELETE' });
    await loadTriggers(siteId);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel accent>
        <PanelHeader code="webhooks" title="Outbound webhooks" subtitle="HMAC-signed POST payloads" />
        <PanelBody className="space-y-4">
          <form onSubmit={addWebhook} className="space-y-3">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-app.com/webhooks/nexus"
              required
            />
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400">
                  <input
                    type="checkbox"
                    checked={events.includes(ev)}
                    onChange={(e) => {
                      setEvents((prev) =>
                        e.target.checked ? [...prev, ev] : prev.filter((x) => x !== ev),
                      );
                    }}
                  />
                  {ev}
                </label>
              ))}
            </div>
            <Button type="submit" disabled={loading}>
              Add webhook
            </Button>
          </form>

          <div className="space-y-2">
            {webhooks.map((w) => (
              <div key={w.id} className="rounded border border-zinc-800/80 p-3">
                <p className="truncate font-mono text-xs text-zinc-300">{w.url}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {w.events.map((ev) => (
                    <Badge key={ev} size="sm">
                      {ev}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 font-mono text-[10px] text-zinc-600">
                  secret: {w.secret.slice(0, 12)}…
                </p>
                <Button
                  variant="secondary"
                  className="mt-2"
                  onClick={() => deleteWebhook(w.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader code="proactive" title="Proactive triggers" subtitle="Widget outreach rules" />
        <PanelBody className="space-y-4">
          {sites.length === 0 ? (
            <p className="text-sm text-zinc-500">Add a deployment first.</p>
          ) : (
            <>
              <label className="block text-sm text-zinc-400">
                Deployment
                <select
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200"
                  value={siteId}
                  onChange={(e) => void loadTriggers(e.target.value)}
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <form onSubmit={addTrigger} className="space-y-3">
                <Input
                  value={triggerName}
                  onChange={(e) => setTriggerName(e.target.value)}
                  placeholder="Trigger name"
                  required
                />
                <select
                  className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200"
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as typeof triggerType)}
                >
                  <option value="idle">Idle on page</option>
                  <option value="page_view">Page URL match</option>
                  <option value="custom_event">Custom event</option>
                </select>
                {triggerType === 'page_view' && (
                  <Input
                    value={pathPattern}
                    onChange={(e) => setPathPattern(e.target.value)}
                    placeholder="/pricing*"
                  />
                )}
                {triggerType === 'idle' && (
                  <Input
                    value={idleSeconds}
                    onChange={(e) => setIdleSeconds(e.target.value)}
                    placeholder="Seconds idle (e.g. 90)"
                  />
                )}
                <Input
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  placeholder="Proactive message"
                  required
                />
                <Button type="submit" disabled={loading}>
                  Add trigger
                </Button>
              </form>

              <div className="space-y-2">
                {triggers.map((t) => (
                  <div key={t.id} className="rounded border border-zinc-800/80 p-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-200">{t.name}</p>
                      <Badge size="sm" variant="tactical">
                        {t.trigger_type}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">{t.message_template}</p>
                    <Button variant="secondary" className="mt-2" onClick={() => deleteTrigger(t.id)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
