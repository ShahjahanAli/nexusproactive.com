'use client';

import Link from 'next/link';
import { useState } from 'react';

const navLinks = [
  { href: '#features', label: 'What it does' },
  { href: '#human-handoff', label: 'Handoff' },
  { href: '#how-it-works', label: 'Setup' },
  { href: '#pricing', label: 'Pricing' },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500 font-mono text-sm font-bold text-zinc-950">
            n
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-zinc-100">nexus</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] text-zinc-400 transition hover:text-zinc-100"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="px-3 py-1.5 text-[13px] text-zinc-400 transition hover:text-zinc-100"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-zinc-100 px-3.5 py-1.5 text-[13px] font-medium text-zinc-950 transition hover:bg-white"
          >
            Start free
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 md:hidden"
        >
          {open ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div className="border-t border-zinc-800/60 bg-zinc-950 px-5 py-3 md:hidden">
          <nav className="flex flex-col">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm text-zinc-400 hover:text-zinc-100"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex gap-3 border-t border-zinc-800/60 pt-3">
              <Link href="/login" onClick={() => setOpen(false)} className="py-1 text-sm text-zinc-400">
                Sign in
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="rounded-md bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-950"
              >
                Start free
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
