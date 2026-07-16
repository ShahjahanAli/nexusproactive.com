'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OpenApiSourceType, SiteOpenApiSource } from '@nexus/shared-types';
import { Button, Input } from '@/components/dashboard/ui/button';
import { Badge } from '@/components/dashboard/ui/badge';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';

export function SiteOpenApiSourcesPanel({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [types, setTypes] = useState<OpenApiSourceType[]>([]);
  const [sources, setSources] = useState<SiteOpenApiSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [typeKey, setTypeKey] = useState('');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [backendBaseUrl, setBackendBaseUrl] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [typesRes, sourcesRes] = await Promise.all([
        fetch('/api/sites/openapi-source-types'),
        fetch(`/api/sites/${siteId}/openapi-sources`),
      ]);
      const typesData = await typesRes.json();
      const sourcesData = await sourcesRes.json();
      if (!typesRes.ok) throw new Error(typesData.error ?? 'Failed to load source types');
      if (!sourcesRes.ok) throw new Error(sourcesData.error ?? 'Failed to load API sources');
      setTypes(typesData.types ?? []);
      setSources(sourcesData.sources ?? []);
      if (!typeKey && typesData.types?.[0]?.key) {
        setTypeKey(typesData.types[0].key);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API sources');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  async function addSource() {
    setBusyId('add');
    setError('');
    setMessage('');
    const res = await fetch(`/api/sites/${siteId}/openapi-sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        typeKey,
        url,
        label: label || null,
        backendBaseUrl: backendBaseUrl || null,
        ingest: true,
      }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(data.error ?? 'Failed to add API source');
      return;
    }
    setUrl('');
    setLabel('');
    setBackendBaseUrl('');
    const ingestMsg = data.ingest
      ? ` Ingested ${data.ingest.actionCount} actions (v${data.ingest.specVersion}).`
      : '';
    setMessage(`API source added.${ingestMsg}`);
    await load();
    router.refresh();
  }

  async function reingest(sourceId: string) {
    setBusyId(sourceId);
    setError('');
    setMessage('');
    const res = await fetch(`/api/sites/${siteId}/openapi-sources/${sourceId}/ingest`, {
      method: 'POST',
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(data.error ?? 'Refresh failed');
      return;
    }
    setMessage(
      `Source refreshed: ${data.actionCount} actions, ${data.newActions} new (v${data.specVersion}).`,
    );
    await load();
    router.refresh();
  }

  async function toggleEnabled(source: SiteOpenApiSource) {
    setBusyId(source.id);
    setError('');
    const res = await fetch(`/api/sites/${siteId}/openapi-sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: !source.is_enabled }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(data.error ?? 'Failed to update source');
      return;
    }
    await load();
    router.refresh();
  }

  async function removeSource(sourceId: string) {
    if (!confirm('Remove this OpenAPI source? Related action versions stay in history.')) {
      return;
    }
    setBusyId(sourceId);
    setError('');
    const res = await fetch(`/api/sites/${siteId}/openapi-sources/${sourceId}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(data.error ?? 'Failed to remove source');
      return;
    }
    setMessage('API source removed');
    await load();
    router.refresh();
  }

  return (
    <Panel>
      <PanelHeader
        code="openapi_sources"
        title="API Sources"
        subtitle="Connect one or more typed OpenAPI URLs, such as products, services, FAQ, or customer data."
      />
      <PanelBody className="space-y-4">
        {loading ? (
          <p className="font-mono text-xs text-zinc-500">Loading API sources...</p>
        ) : (
          <>
            {sources.length === 0 ? (
              <p className="font-mono text-xs text-zinc-500">
                No API sources have been added yet. Add one below, or keep using the legacy URL above.
              </p>
            ) : (
              <ul className="space-y-3">
                {sources.map((source) => (
                  <li
                    key={source.id}
                    className="rounded border border-zinc-800/80 bg-zinc-950/40 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge size="sm" variant={source.is_enabled ? 'success' : 'default'}>
                            {source.type_name ?? source.type_key}
                          </Badge>
                          {source.label && (
                            <span className="font-mono text-[10px] text-zinc-500">
                              {source.label}
                            </span>
                          )}
                        </div>
                        <p className="break-all font-mono text-[11px] text-zinc-300">{source.url}</p>
                        {source.last_ingested_at && (
                          <p className="font-mono text-[10px] text-zinc-600">
                            Last refresh: {new Date(source.last_ingested_at).toLocaleString()}
                          </p>
                        )}
                        {source.last_error && (
                          <p className="font-mono text-[10px] text-red-400">
                            Error: {source.last_error}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === source.id}
                          onClick={() => reingest(source.id)}
                        >
                          {busyId === source.id ? '...' : 'Refresh'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === source.id}
                          onClick={() => toggleEnabled(source)}
                        >
                          {source.is_enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyId === source.id}
                          onClick={() => removeSource(source.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-zinc-800/80 pt-4 space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                Add API source
              </p>
              <label className="block space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  Type
                </span>
                <select
                  className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200"
                  value={typeKey}
                  onChange={(e) => setTypeKey(e.target.value)}
                >
                  {types.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="OpenAPI URL"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/openapi-products.json"
              />
              <Input
                label="Label (optional)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Production products API"
              />
              <Input
                label="Backend base URL override (optional)"
                type="url"
                value={backendBaseUrl}
                onChange={(e) => setBackendBaseUrl(e.target.value)}
                placeholder="Leave blank to use site backend"
              />
              <Button
                type="button"
                disabled={!url || !typeKey || busyId === 'add'}
                onClick={addSource}
              >
                {busyId === 'add' ? 'Adding…' : 'Add & ingest'}
              </Button>
            </div>
          </>
        )}

        {error && (
          <p className="rounded border border-red-500/30 bg-red-950/30 px-3 py-2 font-mono text-xs text-red-400">
                {error}
          </p>
        )}
        {message && (
          <p className="rounded border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 font-mono text-xs text-emerald-400">
            {message}
          </p>
        )}
      </PanelBody>
    </Panel>
  );
}
