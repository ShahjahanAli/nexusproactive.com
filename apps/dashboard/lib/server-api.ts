import { cookies } from 'next/headers';
import { AUTH_COOKIE, getApiUrl } from './config';
import type { AuthUser } from '@nexus/shared-types';

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE)?.value;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(getApiUrl(path), {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const data = await apiFetch<{ user: AuthUser }>('/auth/me');
    return data.user;
  } catch {
    return null;
  }
}
