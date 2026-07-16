'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';
import type { AuthUser } from '@nexus/shared-types';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { UsageMeter } from './usage-meter';
import { TimezoneBadge } from './timezone-badge';
import { LiveAgentDock } from './live-agent-dock';

const navItems = [
  {
    href: '/app',
    label: 'Overview',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    exact: true,
  },
  {
    href: '/app/sites',
    label: 'Sites',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  },
  {
    href: '/app/visitors',
    label: 'Visitors',
    sidebarOnly: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: '/app/analytics',
    label: 'Analytics',
    sidebarOnly: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/app/escalations',
    label: 'Support Inbox',
    sidebarOnly: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/app/team',
    label: 'Team & Agents',
    sidebarOnly: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: '/app/integrations',
    label: 'Integrations',
    sidebarOnly: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    href: '/app/conversations',
    label: 'Conversations',
    sidebarOnly: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    href: '/app/signals',
    label: 'Customer Signals',
    sidebarOnly: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    href: '/app/onboarding',
    label: 'Add Site',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    href: '/app/billing',
    label: 'Billing & Usage',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
];

function NavLink({
  href,
  label,
  icon,
  exact,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        active
          ? 'bg-emerald-500/10 text-emerald-500'
          : 'text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-200'
      }`}
    >
      <span className={active ? 'text-emerald-500' : 'text-zinc-500 group-hover:text-zinc-300'}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
    </Link>
  );
}

export function AppShell({
  user,
  usage,
  children,
}: {
  user: AuthUser | null;
  usage?: { tokens_used: number; max_tokens_month: number } | null;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [liveDockOpen, setLiveDockOpen] = useState(true);
  const showLiveDock =
    user?.role === 'owner' || user?.role === 'admin' || user?.role === 'agent';

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800/80 px-5 py-5">
        <Link href="/app" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm">
            NX
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-100">Nexus Widget</p>
            <p className="text-xs text-zinc-500">Customer AI Dashboard</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            exact={item.exact}
            onNavigate={() => setSidebarOpen(false)}
          />
        ))}
      </nav>

      <div className="border-t border-zinc-800/80 p-3">
        {user && (
          <div className="mb-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-3">
            <p className="truncate text-xs text-zinc-500">Workspace</p>
            <p className="truncate text-sm font-medium text-zinc-100">{user.companyName}</p>
            <div className="mt-2">
              <Badge variant="tactical" size="sm" dot>
                {user.plan}
              </Badge>
            </div>
          </div>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full flex-1 bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl lg:flex lg:flex-col">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-800/80 bg-zinc-950 transition-transform duration-200 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </aside>

      <div
        className={`flex min-h-screen flex-1 flex-col lg:pl-64 ${
          showLiveDock ? (liveDockOpen ? 'lg:pr-[340px]' : 'lg:pr-12') : ''
        }`}
      >
        <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-background/95 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Toggle menu"
                onClick={() => setSidebarOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 lg:hidden"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Badge variant="success" size="sm" dot>
                Online
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <TimezoneBadge />
              {usage && (
                <UsageMeter tokensUsed={usage.tokens_used} tokensLimit={usage.max_tokens_month} />
              )}
              {user && (
                <span className="hidden truncate text-xs text-zinc-500 sm:inline">
                  {user.email}
                </span>
              )}
              <Link
                href="/"
                className="hidden text-xs text-zinc-500 hover:text-zinc-300 sm:inline"
              >
                Website
              </Link>
            </div>
          </div>
        </header>

        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-4 gap-1 px-2 py-2">
            {navItems.filter((i) => !('sidebarOnly' in i && i.sidebarOnly)).map((item) => (
              <MobileNavItem key={item.href} item={item} />
            ))}
          </div>
        </nav>

        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:pb-8">
          <div className="mx-auto max-w-8xl">{children}</div>
        </main>
      </div>

      <LiveAgentDock user={user} open={liveDockOpen} onOpenChange={setLiveDockOpen} />
    </div>
  );
}

function MobileNavItem({
  item,
}: {
  item: (typeof navItems)[number];
}) {
  const pathname = usePathname();
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition ${
        active ? 'text-emerald-500' : 'text-zinc-500'
      }`}
    >
      {item.icon}
      <span className="max-w-[4.5rem] truncate">{item.label.split(' ')[0]}</span>
    </Link>
  );
}
