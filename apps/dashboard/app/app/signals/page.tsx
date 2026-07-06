import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { Panel, PanelBody } from '@/components/dashboard/ui/panel';
import { EmptyState } from '@/components/dashboard/ui/empty-state';
import { Badge } from '@/components/dashboard/ui/badge';

interface Signal {
  id: string;
  site_name: string;
  cluster_label: string | null;
  representative_message: string;
  occurrence_count: number;
  status: string;
  last_seen: string;
}

export default async function SignalsPage() {
  const data = await apiFetch<{ signals: Signal[] }>('/signals').catch(() => ({
    signals: [],
  }));

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="product_signals"
        title="Product signals"
        description="Unresolved intents clustered from low-confidence conversations — feature gaps your customers are asking for."
      />

      {data.signals.length === 0 ? (
        <EmptyState
          title="No signals detected"
          description="Signals populate when visitors ask about unsupported features or routes classify as unknown."
        />
      ) : (
        <div className="space-y-3">
          {data.signals.map((s) => (
            <Panel key={s.id} accent={s.occurrence_count >= 5}>
              <PanelBody>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="warning" size="sm">
                        {s.occurrence_count}× reported
                      </Badge>
                      <span className="font-mono text-[10px] text-zinc-600">{s.site_name}</span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-200">{s.representative_message}</p>
                    {s.cluster_label && (
                      <p className="mt-1 font-mono text-[10px] text-zinc-600">
                        cluster: {s.cluster_label}
                      </p>
                    )}
                  </div>
                  <Badge variant="default" size="sm">
                    {s.status}
                  </Badge>
                </div>
              </PanelBody>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
