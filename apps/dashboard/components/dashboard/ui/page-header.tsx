import { ReactNode } from 'react';

export function PageHeader({
  code,
  title,
  description,
  action,
}: {
  code?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-zinc-800/80 pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
      <div className="min-w-0">
        {code && (
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-500/80">
            // {code}
          </p>
        )}
        <h1 className="mt-1 text-xl font-bold uppercase tracking-wide text-zinc-50 sm:text-2xl lg:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
