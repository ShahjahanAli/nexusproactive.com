import { ReactNode } from 'react';

export function Panel({
  children,
  className = '',
  accent,
}: {
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-zinc-950/70 shadow-sm backdrop-blur-sm ${
        accent
          ? 'border-emerald-500/25 shadow-[inset_0_1px_0_0_rgba(52,211,153,0.08)]'
          : 'border-zinc-800/80'
      } ${className}`}
    >
      {accent && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
      )}
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  code?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-zinc-800/80 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PanelBody({
  children,
  className = '',
  noPadding,
}: {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div className={noPadding ? className : `p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}
