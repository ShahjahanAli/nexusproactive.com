import { apiFetch } from '@/lib/server-api';
import { PageHeader } from '@/components/dashboard/ui/page-header';
import { EscalationInbox, EscalationRow } from '@/components/dashboard/escalation-inbox';

export default async function EscalationsPage() {
  const data = await apiFetch<{ escalations: EscalationRow[] }>('/escalations').catch(() => ({
    escalations: [],
  }));

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        code="escalations"
        title="Human inbox"
        description="Escalated chats from the widget. Claim, reply live, then return to AI or close."
      />
      <EscalationInbox escalations={data.escalations} />
    </div>
  );
}
