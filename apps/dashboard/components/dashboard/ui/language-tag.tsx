import { languageInfo } from '@/lib/language';

/**
 * Language marker for visitor threads. Non-English gets a violet chip so agents
 * spot it while scanning; English stays muted.
 */
export function LanguageTag({
  code,
  size = 'md',
  flagOnly = false,
  showName = false,
}: {
  code: string | null | undefined;
  size?: 'sm' | 'md';
  /** Compact lists: render just the flag, name in the tooltip. */
  flagOnly?: boolean;
  /** Spell out "French" instead of "FR". */
  showName?: boolean;
}) {
  const info = languageInfo(code);
  if (!info) return null;

  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]';
  const tone = info.isEnglish
    ? 'border-zinc-700/80 bg-zinc-900/80 text-zinc-400'
    : 'border-violet-500/40 bg-violet-500/15 text-violet-300';

  return (
    <span
      title={`Visitor language: ${info.name}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded border font-semibold uppercase tracking-wide ${padding} ${tone}`}
    >
      <span aria-hidden className="text-[11px] leading-none">
        {info.flag}
      </span>
      {!flagOnly && <span>{showName ? info.name : info.code}</span>}
    </span>
  );
}
