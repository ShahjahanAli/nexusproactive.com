'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { Button, Input } from '@/components/dashboard/ui/button';
import { Badge } from '@/components/dashboard/ui/badge';

export default function OnboardingContent() {
  const searchParams = useSearchParams();
  const checkoutSuccess = searchParams.get('checkout') === 'success';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [embedSnippet, setEmbedSnippet] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        domain: form.get('domain'),
        backendBaseUrl: form.get('backendBaseUrl'),
        openapiSpecUrl: form.get('openapiSpecUrl') || undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Failed to connect site');
      return;
    }

    const siteId = data.site.id;
    if (data.embedSnippet) {
      setEmbedSnippet(data.embedSnippet);
    } else if (siteId) {
      const cfg = await fetch(`/api/config?siteId=${encodeURIComponent(siteId)}`)
        .then((r) => r.json())
        .catch(() => ({}));
      if (cfg.embedSnippet) setEmbedSnippet(cfg.embedSnippet);
    }
  }

  async function startCheckout(plan: 'starter' | 'growth' | 'scale') {
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 sm:space-y-8">
      <PageHeader
        code="setup"
        title="Add a Site"
        description="Connect a website, configure its backend, and generate the embed code for your chat assistant."
      />

      {checkoutSuccess && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge variant="success" size="sm" dot>
              Payment confirmed
            </Badge>
          </div>
          <p className="mt-2 text-sm text-emerald-400/80">
            Your plan update is being applied now. Refresh in a moment if you do not see it right away.
          </p>
        </div>
      )}

      <Panel>
        <PanelHeader
          code="plans"
          title="Upgrade your plan"
          subtitle="Optional: the trial includes 1 site and 500 conversations per month"
        />
        <PanelBody>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(['starter', 'growth', 'scale'] as const).map((plan) => (
              <Button
                key={plan}
                variant="secondary"
                size="md"
                className="w-full capitalize"
                onClick={() => startCheckout(plan)}
              >
                {plan}
              </Button>
            ))}
          </div>
        </PanelBody>
      </Panel>

      <Panel accent>
        <PanelHeader
          code="site_setup"
          title="Create site"
          subtitle="Add your domain, backend URL, and OpenAPI source"
        />
        <PanelBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input name="name" label="Site name" placeholder="Main website" required />
            <Input name="domain" label="Domain" placeholder="example.com" required />
            <Input
              name="backendBaseUrl"
              label="Backend URL"
              placeholder="https://api.example.com"
              type="url"
              required
            />
            <Input
              name="openapiSpecUrl"
              label="OpenAPI spec URL"
              placeholder="https://api.example.com/openapi.json"
              type="url"
            />
            {error && (
              <p className="rounded border border-red-500/30 bg-red-950/30 px-3 py-2 font-mono text-xs text-red-400">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Creating site…' : 'Create site'}
            </Button>
          </form>

          {embedSnippet && (
            <div className="mt-6 border-t border-zinc-800/80 pt-6">
              <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                Embed code
              </p>
              <pre className="mt-2 overflow-x-auto rounded border border-emerald-500/20 bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-400/90">
                {embedSnippet}
              </pre>
            </div>
          )}
        </PanelBody>
      </Panel>

      <Link
        href="/app"
        className="inline-block font-mono text-[10px] uppercase tracking-wider text-zinc-600 hover:text-zinc-400"
      >
        ← Back to overview
      </Link>
    </div>
  );
}
