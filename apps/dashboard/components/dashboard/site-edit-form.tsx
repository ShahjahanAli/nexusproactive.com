'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Site } from '@nexus/shared-types';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { Button, Input } from '@/components/dashboard/ui/button';
import { Badge } from '@/components/dashboard/ui/badge';

export function SiteEditForm({ site }: { site: Site }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reingesting, setReingesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const theme = (site.widget_theme ?? {}) as Record<string, string | boolean>;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
  const [embedSnippet] = useState(
    `<script>window.NEXUS_API_URL='${apiUrl}';</script>\n<script src="${apiUrl}/widget/nexus.js" defer></script>\n<nexus-chat site-id="${site.id}"></nexus-chat>`,
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
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
        name: form.get('name'),
        domain: form.get('domain'),
        backendBaseUrl: form.get('backendBaseUrl'),
        openapiSpecUrl: openapiSpecUrl || null,
        widgetTheme: {
          primaryColor: form.get('primaryColor'),
          primaryColorDark: form.get('primaryColorDark'),
          title: form.get('widgetTitle'),
          subtitle: form.get('widgetSubtitle'),
          position: form.get('widgetPosition'),
          escalationEnabled: form.get('escalationEnabled') === 'on',
          proactiveEnabled: form.get('proactiveEnabled') === 'on',
        },
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Failed to update deployment');
      return;
    }

    const ingestMsg = data.ingest
      ? ` Action Graph updated: ${data.ingest.actionCount} actions (v${data.ingest.specVersion}).`
      : '';
    setSuccess(`Deployment saved.${ingestMsg}`);
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
      setError(data.error ?? 'Re-ingest failed');
      return;
    }

    if (data.ingest) {
      setSuccess(
        `Action Graph re-ingested: ${data.ingest.actionCount} actions, ${data.ingest.newActions} new.`,
      );
    } else {
      setSuccess('No OpenAPI spec URL configured — add one above first.');
    }
    router.refresh();
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code={`deployment/${site.id.slice(0, 8)}`}
        title="Edit deployment"
        description="Update backend connection, OpenAPI spec, and embed configuration."
        action={
          <Link
            href={`/app/sites/${site.id}`}
            className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
          >
            ← Action graph
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              name="name"
              label="Designation"
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
              label="Backend endpoint"
              defaultValue={site.backend_base_url}
              placeholder="https://api.example.com"
              type="url"
              required
            />
            <Input
              name="openapiSpecUrl"
              label="OpenAPI spec URL"
              defaultValue={site.openapi_spec_url ?? ''}
              placeholder="https://api.example.com/openapi.json"
              type="url"
            />
            <p className="font-mono text-[10px] leading-relaxed text-zinc-600">
              OpenAPI describes your backend endpoints — not the AI provider. Nexus uses this to
              discover which APIs the chatbot can call on your behalf.
            </p>

            {error && (
              <p className="rounded border border-red-500/30 bg-red-950/30 px-3 py-2 font-mono text-xs text-red-400">
                ERR: {error}
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
                disabled={reingesting || !site.openapi_spec_url}
                onClick={handleReingest}
              >
                {reingesting ? 'Re-ingesting…' : 'Re-ingest OpenAPI'}
              </Button>
            </div>
          </form>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader code="widget_theme" title="Widget appearance" subtitle="Loaded by the embed at runtime" />
        <PanelBody>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
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
                name="proactiveEnabled"
                defaultChecked={theme.proactiveEnabled !== false}
              />
              Enable proactive messages
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save widget theme'}
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
