/** Must match API DISPLAY_TIMEZONE (set both in production .env). */
export const DISPLAY_TIMEZONE =
  process.env.NEXT_PUBLIC_DISPLAY_TIMEZONE ??
  process.env.DISPLAY_TIMEZONE ??
  'Asia/Dhaka';

const dateTimeFormatter = () =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

const dateFormatter = () =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const weekdayFormatter = () =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TIMEZONE,
    weekday: 'short',
  });

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/** e.g. 07 Jul 2026, 3:45 pm */
export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter().format(toDate(value));
}

/** e.g. 07 Jul 2026 */
export function formatDate(value: string | Date): string {
  return dateFormatter().format(toDate(value));
}

/** For chart labels; `dateOnly` is YYYY-MM-DD */
export function formatWeekday(dateOnly: string): string {
  return weekdayFormatter().format(new Date(`${dateOnly}T12:00:00Z`));
}

const timeFormatter = () =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

const dayHeadingFormatter = () =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TIMEZONE,
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

/** e.g. 3:45 pm */
export function formatTime(value: string | Date): string {
  return timeFormatter().format(toDate(value));
}

/** e.g. Wednesday, 05 Aug 2026 — transcript day separators */
export function formatDayHeading(value: string | Date): string {
  return dayHeadingFormatter().format(toDate(value));
}

/** Stable day key in the display timezone, for grouping messages. */
export function dayKey(value: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(toDate(value));
}

/** Compact "time ago": 30s, 12m, 5h, 3d */
export function formatRelative(value: string | Date): string {
  const then = toDate(value).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

/** Elapsed time between two instants: 45s, 12m, 1h 20m, 2d 3h */
export function formatDuration(
  from: string | Date,
  to: string | Date = new Date(),
): string {
  const start = toDate(from).getTime();
  const end = toDate(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return '—';
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rem = minutes % 60;
    return rem ? `${hours}h ${rem}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h` : `${days}d`;
}

/** Human label: "Asia/Dhaka (GMT+6)" */
export function getTimezoneLabel(): string {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: DISPLAY_TIMEZONE,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    const name = DISPLAY_TIMEZONE.replace(/_/g, ' ');
    return offset ? `${name} (${offset})` : name;
  } catch {
    return DISPLAY_TIMEZONE;
  }
}
