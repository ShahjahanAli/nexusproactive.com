import { ReactNode } from 'react';

const sizes = {
  sm: 'px-2.5 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

const variants = {
  default: 'border-zinc-700/80 bg-zinc-900/80 text-zinc-300',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  danger: 'border-red-500/40 bg-red-500/10 text-red-400',
  info: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400',
  tactical: 'border-emerald-600/30 bg-emerald-950/40 text-emerald-400',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot,
}: {
  children: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-mono uppercase tracking-wider ${sizes[size]} ${variants[variant]}`}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

export function riskTierBadge(tier: string) {
  const map: Record<string, keyof typeof variants> = {
    read_only: 'info',
    reversible_write: 'success',
    irreversible_write: 'warning',
    financial: 'danger',
  };
  return map[tier] ?? 'default';
}
