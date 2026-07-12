import { NextRequest, NextResponse } from 'next/server';
import { PLATFORM_AUTH_COOKIE, getApiUrl } from '@/lib/config';

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(PLATFORM_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await fetch(getApiUrl('/platform/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const response = NextResponse.json({ user: data.user });
  if (data.token) {
    setSessionCookie(response, data.token);
  }
  return response;
}
