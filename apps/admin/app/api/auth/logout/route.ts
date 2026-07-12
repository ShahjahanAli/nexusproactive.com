import { NextResponse } from 'next/server';
import { PLATFORM_AUTH_COOKIE, getApiUrl } from '@/lib/config';

export async function POST() {
  try {
    await fetch(getApiUrl('/platform/auth/logout'), { method: 'POST' });
  } catch {
    // Best-effort remote logout
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PLATFORM_AUTH_COOKIE, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return response;
}
