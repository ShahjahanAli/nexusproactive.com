/** Runtime public API base URL for widget embeds (not build-time inlined). */
export function getPublicApiUrl(): string {
  const url =
    process.env.PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:5000';
  return url.replace(/\/+$/, '');
}
