import { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  sub,
  icon,
  trend,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const trendColor = {
    up: 'text-emerald-500',
    down: 'text-red-400',
    neutral: 'text-zinc-500',
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-4 shadow-sm transition hover:border-emerald-500/20 sm:p-5">
      <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-emerald-500/5 blur-2xl transition group-hover:bg-emerald-500/10" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-bold tabular-nums text-zinc-50 sm:text-3xl">
            {value}
          </p>
          {sub && (
            <p className={`mt-1 text-xs ${trend ? trendColor[trend] : 'text-zinc-500'}`}>
              {sub}
            </p>
          )}
        </div>
        {icon && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-2 text-emerald-500">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
