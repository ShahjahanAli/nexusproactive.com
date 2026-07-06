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
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-12 text-center sm:py-16">
      {icon && (
        <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-zinc-600">
          {icon}
        </div>
      )}
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">
        No data
      </p>
      <h3 className="mt-2 text-base font-semibold uppercase tracking-wide text-zinc-200">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">{description}</p>
      {action}
      {!action && actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-6 inline-flex items-center rounded border border-emerald-600/40 bg-emerald-950/50 px-4 py-2 font-mono text-xs uppercase tracking-wider text-emerald-400 transition hover:border-emerald-500/60 hover:bg-emerald-950"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
