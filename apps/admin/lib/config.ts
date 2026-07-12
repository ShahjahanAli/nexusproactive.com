const API_URL =
  process.env.PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:5000';
export const PLATFORM_AUTH_COOKIE = 'nexus_platform_session';

export function getApiUrl(path: string): string {
  return `${API_URL.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
