import { Badge } from './ui/badge';

export function UsageMeter({
  tokensUsed,
  tokensLimit,
}: {
  tokensUsed: number;
  tokensLimit: number;
}) {
  const pct = tokensLimit > 0 ? Math.min(100, Math.round((tokensUsed / tokensLimit) * 100)) : 0;
  const variant = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'success';

  const badgeVariant = {
    success: 'success' as const,
    warning: 'warning' as const,
    danger: 'danger' as const,
  };

  function format(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  }

  return (
    <div className="hidden items-center gap-2 sm:flex" title={`${pct}% of monthly token cap used`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-sm bg-zinc-900 ring-1 ring-zinc-800">
        <div
          className={`h-full rounded-sm ${
            variant === 'success'
              ? 'bg-emerald-500'
              : variant === 'warning'
                ? 'bg-amber-500'
                : 'bg-red-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <Badge variant={badgeVariant[variant]} size="sm">
        {format(tokensUsed)} / {format(tokensLimit)} tok
      </Badge>
    </div>
  );
}
