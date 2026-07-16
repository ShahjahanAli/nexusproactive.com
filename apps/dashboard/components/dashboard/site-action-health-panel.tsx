'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/dashboard/ui/panel';
import { Badge } from '@/components/dashboard/ui/badge';
import { Button } from '@/components/dashboard/ui/button';

interface HealthEvent {
  id: string;
  operation_id: string;
  event_type: string;
  severity: string;
  suggestion: string | null;
  created_at: string;
}

export function SiteActionHealthPanel({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/sites/${siteId}/action-health`);
    const data = await res.json().catch(() => ({ events: [] }));
    setEvents(data.events ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  async function resolve(eventId: string) {
    await fetch(`/api/sites/${siteId}/action-health/${eventId}/resolve`, { method: 'POST' });
    await load();
    router.refresh();
  }

  return (
    <Panel>
      <PanelHeader
        title="API Health"
        subtitle="Self-healing alerts when OpenAPI actions fail repeatedly"
      />
      <PanelBody className="space-y-3">
        {loading ? (
          <p className="text-sm text-zinc-500">Checking health…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-zinc-500">No open health issues for this site.</p>
        ) : (
          events.map((e) => (
            <div
              key={e.id}
              className="rounded-lg border border-zinc-800/80 px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={e.severity === 'critical' ? 'danger' : 'warning'} size="sm">
                  {e.severity}
                </Badge>
                <span className="text-sm font-medium text-zinc-200">{e.operation_id}</span>
                <Badge variant="default" size="sm">
                  {e.event_type.replace(/_/g, ' ')}
                </Badge>
              </div>
              {e.suggestion && (
                <p className="mt-2 text-sm text-zinc-400">{e.suggestion}</p>
              )}
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={() => resolve(e.id)}>
                  Mark resolved
                </Button>
              </div>
            </div>
          ))
        )}
      </PanelBody>
    </Panel>
  );
}
