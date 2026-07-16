'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Site } from '@nexus/shared-types';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { Button, Input } from '@/components/dashboard/ui/button';
import { Badge } from '@/components/dashboard/ui/badge';

import { buildEmbedSnippet } from '@/lib/embed-snippet';
import { SiteOpenApiSourcesPanel } from '@/components/dashboard/site-openapi-sources-panel';
import { SiteActionHealthPanel } from '@/components/dashboard/site-action-health-panel';

function formErrorMessage(data: { error?: string; message?: string }): string {
  return data.error ?? data.message ?? 'Request failed';
}

export function SiteEditForm({
  site,
  embedSnippet: embedSnippetProp,
}: {
  site: Site;
  embedSnippet?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [widgetLoading, setWidgetLoading] = useState(false);
  const [reingesting, setReingesting] = useState(false);
  const [error, setError] = useState('');
  const [widgetError, setWidgetError] = useState('');
  const [success, setSuccess] = useState('');
  const [widgetSuccess, setWidgetSuccess] = useState('');
  const theme = (site.widget_theme ?? {}) as Record<string, string | boolean | number>;
  const [embedSnippet] = useState(
    embedSnippetProp ?? buildEmbedSnippet(site.id),
  );

  async function handleSiteSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const form = new FormData(e.currentTarget);
    const openapiSpecUrl = String(form.get('openapiSpecUrl') ?? '').trim();

    const res = await fetch(`/api/sites/${site.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: String(form.get('name') ?? '').trim(),
        domain: String(form.get('domain') ?? '').trim(),
        backendBaseUrl: String(form.get('backendBaseUrl') ?? '').trim(),
        openapiSpecUrl: openapiSpecUrl || null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(formErrorMessage(data));
      return;
    }

    const ingestMsg = data.ingest
      ? ` API actions updated: ${data.ingest.actionCount} actions (v${data.ingest.specVersion}).`
      : '';
    setSuccess(`Site settings saved.${ingestMsg}`);
    router.refresh();
  }

  async function handleWidgetSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWidgetLoading(true);
    setWidgetError('');
    setWidgetSuccess('');

    const form = new FormData(e.currentTarget);
    const maxRaw = parseInt(String(form.get('maxUserMessages') ?? '20'), 10);
    const widgetTheme = {
      primaryColor: String(form.get('primaryColor') ?? '').trim() || undefined,
      primaryColorDark: String(form.get('primaryColorDark') ?? '').trim() || undefined,
      title: String(form.get('widgetTitle') ?? '').trim() || undefined,
      subtitle: String(form.get('widgetSubtitle') ?? '').trim() || undefined,
      position: String(form.get('widgetPosition') ?? 'bottom-right'),
      escalationEnabled: form.get('escalationEnabled') === 'on',
      proactiveEnabled: form.get('proactiveEnabled') === 'on',
      contactCollectionEnabled: form.get('contactCollectionEnabled') === 'on',
      maxUserMessages: Number.isFinite(maxRaw) ? maxRaw : 20,
      whatsappNumber: String(form.get('whatsappNumber') ?? '').trim() || undefined,
      whatsappPrefillMessage: String(form.get('whatsappPrefillMessage') ?? '').trim() || undefined,
      guardrailMessage: String(form.get('guardrailMessage') ?? '').trim() || undefined,
    };

    const res = await fetch(`/api/sites/${site.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetTheme }),
    });

    const data = await res.json();
    setWidgetLoading(false);

    if (!res.ok) {
      setWidgetError(formErrorMessage(data));
      return;
    }

    setWidgetSuccess('Widget appearance saved.');
    router.refresh();
  }

  async function handleReingest() {
    setReingesting(true);
    setError('');
    setSuccess('');

    const res = await fetch(`/api/sites/${site.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reingest: true }),
    });

    const data = await res.json();
    setReingesting(false);

    if (!res.ok) {
      setError(formErrorMessage(data));
      return;
    }

    if (data.ingest) {
      setSuccess(
        `API actions refreshed: ${data.ingest.actionCount} actions, ${data.ingest.newActions} new.`,
      );
    } else {
      setSuccess('No OpenAPI spec URL configured — add one above first.');
    }
    router.refresh();
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code={`site_settings/${site.id.slice(0, 8)}`}
        title="Site Settings"
        description="Manage the site's backend connection, OpenAPI sources, widget behavior, and embed code."
        action={
          <Link
            href={`/app/sites/${site.id}`}
            className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
          >
            ← API actions
          </Link>
        }
      />

      <Panel accent>
        <PanelHeader
          code="site_config"
          title={site.name}
          subtitle={`Site ID: ${site.id}`}
        />
        <PanelBody>
          <form onSubmit={(e) => void handleSiteSubmit(e)} className="space-y-4">
            <Input
              name="name"
              label="Site name"
              defaultValue={site.name}
              placeholder="Production API"
              required
            />
            <Input
              name="domain"
              label="Domain"
              defaultValue={site.domain}
              placeholder="example.com"
              required
            />
            <Input
              name="backendBaseUrl"
              label="Backend URL"
              defaultValue={site.backend_base_url}
              placeholder="https://api.example.com"
              type="url"
              required
            />
            <Input
              name="openapiSpecUrl"
              label="Primary OpenAPI URL (legacy, optional)"
              defaultValue={site.openapi_spec_url ?? ''}
              placeholder="https://api.example.com/openapi.json"
              type="url"
            />
            <p className="font-mono text-[10px] leading-relaxed text-zinc-600">
              Prefer the typed API sources below for ongoing setup. This field remains available for
              older site configurations and mirrors the first enabled source.
            </p>

            {error && (
              <p className="rounded border border-red-500/30 bg-red-950/30 px-3 py-2 font-mono text-xs text-red-400">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 font-mono text-xs text-emerald-400">
                {success}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save changes'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={reingesting}
                onClick={() => void handleReingest()}
              >
                {reingesting ? 'Refreshing…' : 'Refresh all sources'}
              </Button>
            </div>
          </form>
        </PanelBody>
      </Panel>

      <SiteOpenApiSourcesPanel siteId={site.id} />

      <SiteActionHealthPanel siteId={site.id} />

      <Panel>
        <PanelHeader
          code="widget_appearance"
          title="Widget appearance"
          subtitle="Applied to the website chat widget at runtime"
        />
        <PanelBody>
          <form onSubmit={(e) => void handleWidgetSubmit(e)} className="grid gap-4 sm:grid-cols-2">
            <Input
              name="primaryColor"
              label="Primary color"
              defaultValue={String(theme.primaryColor ?? '#059669')}
              placeholder="#059669"
            />
            <Input
              name="primaryColorDark"
              label="Primary dark"
              defaultValue={String(theme.primaryColorDark ?? '#047857')}
              placeholder="#047857"
            />
            <Input
              name="widgetTitle"
              label="Header title"
              defaultValue={String(theme.title ?? 'Nexus Assistant')}
            />
            <Input
              name="widgetSubtitle"
              label="Header subtitle"
              defaultValue={String(theme.subtitle ?? '● Online')}
            />
            <label className="block text-sm text-zinc-400 sm:col-span-2">
              Position
              <select
                name="widgetPosition"
                defaultValue={String(theme.position ?? 'bottom-right')}
                className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200"
              >
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-left">Bottom left</option>
              </select>
            </label>
            <label className="flex items-center gap-2 font-mono text-xs text-zinc-400">
              <input
                type="checkbox"
                name="escalationEnabled"
                defaultChecked={theme.escalationEnabled !== false}
              />
              Show Human escalation button
            </label>
            <label className="flex items-center gap-2 font-mono text-xs text-zinc-400">
              <input
                type="checkbox"
                name="contactCollectionEnabled"
                defaultChecked={theme.contactCollectionEnabled !== false}
              />
              AI asks for contact info (name, email, phone)
            </label>
            <label className="flex items-center gap-2 font-mono text-xs text-zinc-400">
              <input
                type="checkbox"
                name="proactiveEnabled"
                defaultChecked={theme.proactiveEnabled !== false}
              />
              Enable proactive messages
            </label>
            <Input
              name="maxUserMessages"
              label="Max AI user messages per chat"
              type="number"
              min={0}
              defaultValue={String(theme.maxUserMessages ?? 20)}
              placeholder="20 (0 = unlimited)"
            />
            <Input
              name="whatsappNumber"
              label="WhatsApp number (handoff)"
              defaultValue={String(theme.whatsappNumber ?? '')}
              placeholder="+15551234567"
            />
            <Input
              name="whatsappPrefillMessage"
              label="WhatsApp prefill message"
              defaultValue={String(theme.whatsappPrefillMessage ?? '')}
              placeholder="Hi, I need help from your website chat…"
            />
            <Input
              name="guardrailMessage"
              label="Limit reached message"
              className="sm:col-span-2"
              defaultValue={String(theme.guardrailMessage ?? '')}
              placeholder="You've reached the automated chat limit. Our team has been notified…"
            />
            {widgetError && (
              <p className="sm:col-span-2 rounded border border-red-500/30 bg-red-950/30 px-3 py-2 font-mono text-xs text-red-400">
                {widgetError}
              </p>
            )}
            {widgetSuccess && (
              <p className="sm:col-span-2 rounded border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 font-mono text-xs text-emerald-400">
                {widgetSuccess}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={widgetLoading}>
                {widgetLoading ? 'Saving…' : 'Save widget theme'}
              </Button>
            </div>
          </form>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          code="embed_snippet"
          title="Widget embed"
          subtitle="Paste on the client website"
        />
        <PanelBody>
          <pre className="overflow-x-auto rounded border border-emerald-500/20 bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-400/90">
            {embedSnippet}
          </pre>
          <p className="mt-3 text-sm text-zinc-500">
            Optional: add{' '}
            <code className="font-mono text-[11px] text-zinc-400">visitor-id=&quot;user_123&quot;</code>{' '}
            for logged-in users so chats persist across devices and appear in the Visitors dashboard.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="default" size="sm">
              site-id: {site.id.slice(0, 8)}…
            </Badge>
            {site.openapi_spec_url ? (
              <Badge variant="success" size="sm" dot>
                OpenAPI linked
              </Badge>
            ) : (
              <Badge variant="warning" size="sm">
                No OpenAPI spec
              </Badge>
            )}
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
