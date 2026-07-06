import { getTimezoneLabel } from '@/lib/datetime';

export function TimezoneBadge() {
  return (
    <span
      className="hidden font-mono text-[10px] text-zinc-600 lg:inline"
      title="All dates and analytics buckets use this timezone"
    >
      {getTimezoneLabel()}
    </span>
  );
}
