'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';
import type { AuthUser } from '@nexus/shared-types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { UsageMeter } from './usage-meter';
import { TimezoneBadge } from './timezone-badge';

const navItems = [
  {
    href: '/app',
    label: 'Command',
    code: 'CMD',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    exact: true,
  },
  {
    href: '/app/sites',
    label: 'Deployments',
    code: 'DPL',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  },
  {
    href: '/app/visitors',
    label: 'Visitors',
    code: 'VIS',
    sidebarOnly: true,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: '/app/analytics',
    label: 'Telemetry',
    code: 'TEL',
    sidebarOnly: true,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/app/escalations',
    label: 'Inbox',
    code: 'INB',
    sidebarOnly: true,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/app/integrations',
    label: 'Integrations',
    code: 'INTG',
    sidebarOnly: true,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    href: '/app/conversations',
    label: 'Comms',
    code: 'COM',
    sidebarOnly: true,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    href: '/app/signals',
    label: 'Signals',
    code: 'SIG',
    sidebarOnly: true,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/app/onboarding',
    label: 'Integrate',
    code: 'INT',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    href: '/app/billing',
    label: 'Resources',
    code: 'RES',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
];

function NavLink({
  href,
  label,
  code,
  icon,
  exact,
  onNavigate,
}: {
  href: string;
  label: string;
  code: string;
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
      className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
        active
          ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-400'
          : 'border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900/60 hover:text-zinc-300'
      }`}
    >
      <span className={active ? 'text-emerald-500' : 'text-zinc-600 group-hover:text-zinc-400'}>
        {icon}
      </span>
      <span className="flex-1">
        <span className="block font-mono text-[10px] tracking-widest opacity-60">{code}</span>
        <span className="block text-xs font-semibold uppercase tracking-wide">{label}</span>
      </span>
      {active && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
      )}
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

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800/80 px-4 py-4">
        <Link href="/app" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded border border-emerald-500/30 bg-emerald-950/50 font-mono text-sm font-bold text-emerald-400">
            NX
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-500/70">
              Nexus Widget
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-200">
              Ops Console
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            onNavigate={() => setSidebarOpen(false)}
          />
        ))}
      </nav>

      <div className="border-t border-zinc-800/80 p-3">
        {user && (
          <div className="mb-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2.5">
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-zinc-600">
              Operator
            </p>
            <p className="truncate text-sm font-medium text-zinc-200">{user.companyName}</p>
            <div className="mt-2">
              <Badge variant="tactical" size="sm" dot>
                {user.plan}
              </Badge>
            </div>
          </div>
        )}
        <Button variant="ghost" size="sm" className="w-full" onClick={logout}>
          Disconnect
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full flex-1 bg-[#070908] text-zinc-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl lg:flex lg:flex-col">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-zinc-800/80 bg-zinc-950 transition-transform duration-200 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </aside>

      {/* Main content */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#070908]/90 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Toggle menu"
                onClick={() => setSidebarOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-800 text-zinc-400 lg:hidden"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Badge variant="success" size="sm" dot>
                Systems online
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <TimezoneBadge />
              {usage && (
                <UsageMeter tokensUsed={usage.tokens_used} tokensLimit={usage.max_tokens_month} />
              )}
              {user && (
                <span className="hidden truncate font-mono text-xs text-zinc-500 sm:inline">
                  {user.email}
                </span>
              )}
              <Link
                href="/"
                className="hidden font-mono text-[10px] uppercase tracking-wider text-zinc-600 hover:text-zinc-400 sm:inline"
              >
                Exit to site
              </Link>
            </div>
          </div>
        </header>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-4 gap-1 px-2 py-2">
            {navItems.filter((i) => !('sidebarOnly' in i && i.sidebarOnly)).map((item) => (
              <MobileNavItem key={item.href} item={item} />
            ))}
          </div>
        </nav>

        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:pb-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Tactical grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(52,211,153,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,.3) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
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
      className={`flex flex-col items-center gap-0.5 rounded-lg py-2 transition ${
        active ? 'text-emerald-400' : 'text-zinc-600'
      }`}
    >
      {item.icon}
      <span className="font-mono text-[9px] uppercase tracking-wider">{item.code}</span>
    </Link>
  );
}
