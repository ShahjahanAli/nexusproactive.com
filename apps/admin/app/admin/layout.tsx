import { getCurrentAdmin } from '@/lib/server-api';
import { AdminShell } from '@/components/admin/admin-shell';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentAdmin();
  if (!user) {
    redirect('/login');
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
