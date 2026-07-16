'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';

const navLinks = [
  { href: '#platform-overview', label: 'Overview' },
  { href: '#features', label: 'Capabilities' },
  { href: '#flow-diagram', label: 'Platform flow' },
  { href: '#pricing', label: 'Pricing' },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/25">
            N
          </span>
          <div>
            <p className="text-base font-semibold tracking-tight text-slate-50 sm:text-lg">
              Nexus Widget
            </p>
            <p className="text-xs text-slate-500">AI chat platform for live business operations</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-slate-400 transition hover:text-slate-50"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle className="border-white/10 text-slate-300 hover:border-white/20 hover:bg-white/5 hover:text-slate-50" />
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-slate-50"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Start free
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle className="border-white/10 text-slate-300 hover:border-white/20 hover:bg-white/5 hover:text-slate-50" />
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-300"
          >
            {open ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/5 bg-slate-950/95 px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-slate-50"
              >
                {link.label}
              </a>
            ))}
            <hr className="my-2 border-white/5" />
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-xl bg-white px-3 py-2.5 text-center text-sm font-semibold text-slate-950"
            >
              Start free
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}