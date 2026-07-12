import { cookies } from 'next/headers';
import { PLATFORM_AUTH_COOKIE, getApiUrl } from './config';
import type { PlatformAuthUser } from '@nexus/shared-types';

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(PLATFORM_AUTH_COOKIE)?.value;
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

export async function getCurrentAdmin(): Promise<PlatformAuthUser | null> {
  try {
    const data = await apiFetch<{ user: PlatformAuthUser }>('/platform/auth/me');
    return data.user;
  } catch {
    return null;
  }
}
