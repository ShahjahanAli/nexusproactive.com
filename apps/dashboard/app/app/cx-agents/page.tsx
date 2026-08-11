import { getCurrentUser } from '@/lib/server-api';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CxAgentsList } from '@/components/dashboard/cx-agents-list';
import { CxDefaultKnowledgePanel } from '@/components/dashboard/cx-default-knowledge-panel';

export default async function CxAgentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const canManage = user.role === 'owner' || user.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">CX Agents</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Dedicated Customer Experience AI agents for your account. They handle product and FAQ
          questions, drive sales, and call specialists when needed — within your plan capacity.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/app/cx-agents/live" className="text-emerald-400/90 hover:text-emerald-300">
            Live graph
          </Link>
          <span className="text-zinc-700">·</span>
          <Link
            href="/app/cx-agents/leaderboard"
            className="text-emerald-400/90 hover:text-emerald-300"
          >
            Leaderboard
          </Link>
          <span className="text-zinc-700">·</span>
          <Link
            href="#default-knowledge"
            className="text-emerald-400/90 hover:text-emerald-300"
          >
            Default knowledge
          </Link>
        </div>
      </div>
      <CxAgentsList currentRole={user.role} />
      <div id="default-knowledge">
        <CxDefaultKnowledgePanel canManage={canManage} />
      </div>
    </div>
  );
}
