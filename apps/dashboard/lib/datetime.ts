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
