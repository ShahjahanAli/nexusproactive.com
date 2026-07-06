import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, getApiUrl } from '@/lib/config';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  const res = await fetch(getApiUrl('/tenant/portal'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
