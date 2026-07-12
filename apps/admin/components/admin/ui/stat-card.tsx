import { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-4 transition hover:border-amber-500/20 sm:p-5">
      <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-amber-500/5 blur-2xl transition group-hover:bg-amber-500/10" />
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 truncate font-mono text-2xl font-bold tabular-nums text-zinc-50 sm:text-3xl">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}
