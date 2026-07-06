const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
export const AUTH_COOKIE = 'nexus_session';

export function getApiUrl(path: string): string {
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
