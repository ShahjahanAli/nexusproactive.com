import { getCurrentUser } from '@/lib/server-api';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CxAgentWizard } from '@/components/dashboard/cx-agent-wizard';
import { CxConsultsPanel } from '@/components/dashboard/cx-consults-panel';
import { CxKnowledgePanel } from '@/components/dashboard/cx-knowledge-panel';
import { CxSalesRatingsPanel } from '@/components/dashboard/cx-sales-ratings-panel';

export default async function EditCxAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const canManage = user.role === 'owner' || user.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/cx-agents" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← CX Agents
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">
          Edit CX Agent
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Configure persona, sales goals, ratings, knowledge, and review specialist consults.
        </p>
      </div>
      <CxAgentWizard mode="edit" agentId={id} />
      <CxKnowledgePanel cxAgentId={id} canManage={canManage} />
      <CxSalesRatingsPanel cxAgentId={id} />
      <CxConsultsPanel cxAgentId={id} />
    </div>
  );
}
