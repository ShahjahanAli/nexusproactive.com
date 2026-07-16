import Link from 'next/link';
import type { ListSearchParams } from '@/lib/list-params';
import { pageCount } from '@/lib/list-params';

export function ListPagination({
  total,
  limit,
  page,
  basePath,
  params,
}: {
  total: number;
  limit: number;
  page: number;
  basePath: string;
  params: ListSearchParams;
}) {
  const pages = pageCount(total, limit);
  if (total <= limit) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  function href(targetPage: number) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value?.trim()) qs.set(key, value.trim());
    }
    if (targetPage > 1) qs.set('page', String(targetPage));
    else qs.delete('page');
    const query = qs.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-800/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm text-zinc-500">
        Showing {start}–{end} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <PaginationLink href={href(page - 1)} disabled={page <= 1} label="Previous" />
        <span className="px-2 text-sm tabular-nums text-zinc-400">
          Page {page} of {pages}
        </span>
        <PaginationLink href={href(page + 1)} disabled={page >= pages} label="Next" />
      </div>
    </div>
  );
}

function PaginationLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-zinc-800/60 px-3 py-1.5 text-sm text-zinc-600">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
    >
      {label}
    </Link>
  );
}
