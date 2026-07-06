export function ProgressBar({
  label,
  current,
  limit,
  pct,
  unit = '',
}: {
  label: string;
  current: number;
  limit: number;
  pct: number;
  unit?: string;
}) {
  const status =
    pct >= 90 ? 'critical' : pct >= 70 ? 'warning' : 'nominal';

  const barColor = {
    nominal: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
  };

  const glowColor = {
    nominal: 'shadow-emerald-500/30',
    warning: 'shadow-amber-500/30',
    critical: 'shadow-red-500/30',
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        <span className="font-mono text-xs tabular-nums text-zinc-300">
          {current.toLocaleString()}
          {unit} / {limit.toLocaleString()}
          {unit}
          <span className="ml-2 text-zinc-600">[{pct}%]</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-zinc-900 ring-1 ring-zinc-800">
        <div
          className={`h-full rounded-sm shadow-sm transition-all duration-500 ${barColor[status]} ${glowColor[status]}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
