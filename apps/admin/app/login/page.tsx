'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/components/admin/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Login failed');
      return;
    }

    router.push('/admin');
    router.refresh();
  }

  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="relative w-full max-w-md rounded-lg border border-zinc-800/80 bg-zinc-950/90 p-6 shadow-2xl backdrop-blur sm:p-8">
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded border border-amber-500/30 bg-amber-950/50 font-mono text-sm font-bold text-amber-400">
              SA
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-500/70">
                Nexus Platform
              </p>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
                Super Admin
              </p>
            </div>
          </div>
          <h1 className="text-xl font-bold uppercase tracking-wide text-zinc-50 sm:text-2xl">
            Platform access
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Authenticate with a platform admin credential.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            name="email"
            label="Admin email"
            type="email"
            required
            autoComplete="email"
          />
          <Input
            id="password"
            name="password"
            label="Password"
            type="password"
            required
            autoComplete="current-password"
          />
          {error && (
            <p className="rounded border border-red-500/30 bg-red-950/30 px-3 py-2 font-mono text-xs text-red-400">
              ERR: {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? 'Authenticating…' : 'Enter control plane'}
          </Button>
        </form>
      </div>
    </div>
  );
}
