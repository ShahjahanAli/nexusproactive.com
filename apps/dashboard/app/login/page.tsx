'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/components/dashboard/ui/button';

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

    router.push('/app');
    router.refresh();
  }

  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center bg-[#070908] px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(52,211,153,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="relative w-full max-w-md rounded-lg border border-zinc-800/80 bg-zinc-950/90 p-6 shadow-2xl backdrop-blur sm:p-8">
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded border border-emerald-500/30 bg-emerald-950/50 font-mono text-sm font-bold text-emerald-400">
              NX
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-500/70">
                Nexus Widget
              </p>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
                Ops Console
              </p>
            </div>
          </div>
          <h1 className="text-xl font-bold uppercase tracking-wide text-zinc-50 sm:text-2xl">
            Authenticate
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Enter credentials to access the command center.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            name="email"
            label="Operator email"
            type="email"
            required
            autoComplete="email"
          />
          <Input
            id="password"
            name="password"
            label="Access key"
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
            {loading ? 'Authenticating…' : 'Initiate session'}
          </Button>
        </form>

        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-wider text-zinc-600">
          No clearance?{' '}
          <Link href="/signup" className="text-emerald-500 hover:text-emerald-400">
            Request access
          </Link>
        </p>
      </div>
    </div>
  );
}
