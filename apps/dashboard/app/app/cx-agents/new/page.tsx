import { getCurrentUser } from '@/lib/server-api';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CxAgentWizard } from '@/components/dashboard/cx-agent-wizard';

export default async function NewCxAgentPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'owner' && user.role !== 'admin') redirect('/app/cx-agents');

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/cx-agents" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← CX Agents
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">
          Create CX Agent
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Follow the steps below. Each field includes guidance — hover tips and short help text
          explain what visitors and the AI will use.
        </p>
      </div>
      <CxAgentWizard mode="create" />
    </div>
  );
}
