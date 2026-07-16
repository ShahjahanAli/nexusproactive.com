'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface SiteOption {
  id: string;
  name: string;
}

export interface SelectFilterField {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

export function ListFilters({
  basePath,
  initialValues,
  searchPlaceholder = 'Search…',
  showSearch = true,
  sites = [],
  selects = [],
}: {
  basePath: string;
  initialValues: Record<string, string | undefined>;
  searchPlaceholder?: string;
  showSearch?: boolean;
  sites?: SiteOption[];
  selects?: SelectFilterField[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialValues.q ?? '');
  const [siteId, setSiteId] = useState(initialValues.siteId ?? '');
  const [selectValues, setSelectValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    for (const field of selects) {
      values[field.name] = initialValues[field.name] ?? '';
    }
    return values;
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (showSearch && q.trim()) params.set('q', q.trim());
    if (siteId) params.set('siteId', siteId);
    for (const field of selects) {
      const value = selectValues[field.name];
      if (value) params.set(field.name, value);
    }
    router.push(params.toString() ? `${basePath}?${params.toString()}` : basePath);
  }

  function reset() {
    setQ('');
    setSiteId('');
    const cleared: Record<string, string> = {};
    for (const field of selects) cleared[field.name] = '';
    setSelectValues(cleared);
    router.push(basePath);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {showSearch && (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15"
            />
          </div>
        )}

        {sites.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">Site</label>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
            >
              <option value="">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {selects.map((field) => (
          <div key={field.name}>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">{field.label}</label>
            <select
              value={selectValues[field.name] ?? ''}
              onChange={(e) =>
                setSelectValues((prev) => ({ ...prev, [field.name]: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
            >
              {field.options.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-lg border border-emerald-600/50 bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
        >
          Apply filters
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
