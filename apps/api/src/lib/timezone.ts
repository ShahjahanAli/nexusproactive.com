/** IANA timezone for admin display + analytics day/month boundaries (Bangladesh default). */
export function getDisplayTimezone(): string {
  const tz = process.env.DISPLAY_TIMEZONE ?? 'Asia/Dhaka';
  if (!/^[A-Za-z0-9_+\/-]+$/.test(tz)) return 'Asia/Dhaka';
  return tz;
}

/** First day of current calendar month in DISPLAY_TIMEZONE (YYYY-MM-01). */
export function currentPeriodStart(): string {
  const tz = getDisplayTimezone();
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  return `${year}-${month}-01`;
}
