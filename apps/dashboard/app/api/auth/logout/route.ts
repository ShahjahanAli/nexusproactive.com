import { NextResponse } from 'next/server';
import { AUTH_COOKIE, getApiUrl } from '@/lib/config';

export async function POST() {
  await fetch(getApiUrl('/auth/logout'), { method: 'POST' }).catch(() => {});
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE);
  return response;
}
