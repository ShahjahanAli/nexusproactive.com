'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';
import type { PlatformAuthUser } from '@nexus/shared-types';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

const navItems = [
  {
    href: '/admin',
    label: 'Overview',
    code: 'OVR',
    exact: true,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  {
    href: '/admin/tenants',
    label: 'Tenants',
    code: 'TNT',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    href: '/admin/plans',
    label: 'Plans',
    code: 'PLN',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    href: '/admin/features',
    label: 'Features',
    code: 'FTR',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    code: 'CFG',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/admin/audit',
    label: 'Audit Log',
    code: 'AUD',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
          ? 'border-amber-500/30 bg-amber-950/40 text-amber-400'
          : 'border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900/60 hover:text-zinc-300'
      }`}
    >
      <span className={active ? 'text-amber-500' : 'text-zinc-600 group-hover:text-zinc-400'}>
        {icon}
      </span>
      <span className="flex-1">
        <span className="block font-mono text-[10px] tracking-widest opacity-60">{code}</span>
        <span className="block text-xs font-semibold uppercase tracking-wide">{label}</span>
      </span>
      {active && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
      )}
    </Link>
  );
}

export function AdminShell({
  user,
  children,
}: {
  user: PlatformAuthUser | null;
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
        <Link href="/admin" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded border border-amber-500/30 bg-amber-950/50 font-mono text-sm font-bold text-amber-400">
            SA
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-500/70">
              Nexus Platform
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-200">
              Super Admin
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
              Platform operator
            </p>
            <p className="truncate text-sm font-medium text-zinc-200">
              {user.name ?? user.email}
            </p>
            <div className="mt-2">
              <Badge variant="tactical" size="sm" dot>
                {user.role}
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
    <div className="flex min-h-screen w-full flex-1 bg-background text-zinc-100">
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
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-zinc-800/80 bg-zinc-950 transition-transform duration-200 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-background/90 backdrop-blur-xl">
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
              <Badge variant="warning" size="sm" dot>
                Control plane
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {user && (
                <span className="hidden truncate font-mono text-xs text-zinc-500 sm:inline">
                  {user.email}
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
    </div>
  );
}
