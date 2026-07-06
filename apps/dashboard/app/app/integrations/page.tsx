import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { IntegrationsPanel } from '@/components/dashboard/integrations-panel';

export default async function IntegrationsPage() {
  const [webhookData, sitesData] = await Promise.all([
    apiFetch<{
      subscriptions: Array<{
        id: string;
        url: string;
        events: string[];
        is_active: boolean;
        secret: string;
        created_at: string;
      }>;
    }>('/webhook-subscriptions').catch(() => ({ subscriptions: [] })),
    apiFetch<{ sites: Array<{ id: string; name: string }> }>('/sites').catch(() => ({ sites: [] })),
  ]);

  const firstSite = sitesData.sites[0];
  let triggers: Array<{
    id: string;
    name: string;
    trigger_type: string;
    conditions: Record<string, unknown>;
    message_template: string;
    is_active: boolean;
  }> = [];

  if (firstSite) {
    try {
      const res = await apiFetch<{ triggers: typeof triggers }>(
        `/proactive/sites/${firstSite.id}/triggers`,
      );
      triggers = res.triggers;
    } catch {
      triggers = [];
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="integrations"
        title="Integrations"
        description="Webhooks for your stack and proactive widget triggers per deployment."
      />
      <IntegrationsPanel
        webhooks={webhookData.subscriptions}
        sites={sitesData.sites}
        initialTriggers={triggers}
      />
    </div>
  );
}
