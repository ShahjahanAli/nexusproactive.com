import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, getApiUrl } from '@/lib/config';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  const body = await request.text();

  const res = await fetch(getApiUrl('/auth/checkout'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
