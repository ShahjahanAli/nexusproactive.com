'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function TenantFilters({
  initialQ,
  initialPlan,
  initialStatus,
}: {
  initialQ?: string;
  initialPlan?: string;
  initialStatus?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ ?? '');
  const [plan, setPlan] = useState(initialPlan ?? '');
  const [status, setStatus] = useState(initialStatus ?? '');

  function submit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (plan) params.set('plan', plan);
    if (status) params.set('status', status);
    router.push(`/admin/tenants?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          Search
        </label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Company, email, or ID"
          className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-sm text-zinc-100 outline-none focus:border-amber-500/50"
        />
      </div>
      <div>
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          Plan
        </label>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-sm text-zinc-100"
        >
          <option value="">All</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="scale">Scale</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-sm text-zinc-100"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="churned">Churned</option>
        </select>
      </div>
      <button
        type="submit"
        className="rounded border border-amber-600/50 bg-amber-950/60 px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-amber-400"
      >
        Filter
      </button>
    </form>
  );
}
