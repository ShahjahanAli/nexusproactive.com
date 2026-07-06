import { getCurrentUser, apiFetch } from '@/lib/server-api';
import { AppShell } from '@/components/dashboard/app-shell';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const plan = await apiFetch<{
    usage: { tokens_used: number };
    limits: { max_tokens_month: number };
  }>('/tenant/plan').catch(() => null);

  return (
    <AppShell
      user={user}
      usage={
        plan
          ? { tokens_used: plan.usage.tokens_used, max_tokens_month: plan.limits.max_tokens_month }
          : null
      }
    >
      {children}
    </AppShell>
  );
}
