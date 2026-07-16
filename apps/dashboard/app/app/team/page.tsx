import { getCurrentUser } from '@/lib/server-api';
import { redirect } from 'next/navigation';
import { TeamManager } from '@/components/dashboard/team-manager';

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Team & agents</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Create human agents who can pick up any live customer thread from the chat panel on the
          right. Admins and owners manage access for this account.
        </p>
      </div>
      <TeamManager currentRole={user.role} />
    </div>
  );
}
