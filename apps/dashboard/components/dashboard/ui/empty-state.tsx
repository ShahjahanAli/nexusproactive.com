import Link from 'next/link';
import { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
  actionLabel,
  actionHref,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  actionLabel?: string;
  actionHref?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50 px-6 py-12 text-center sm:py-16">
      {icon && (
        <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-zinc-500">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">{description}</p>
      {action}
      {!action && actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-6 inline-flex items-center rounded-lg border border-emerald-600/40 bg-emerald-950/50 px-4 py-2 text-sm font-medium text-emerald-500 transition hover:border-emerald-500/60 hover:bg-emerald-950"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
