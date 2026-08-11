import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, getApiUrl } from '@/lib/config';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  const qs = request.nextUrl.searchParams.toString();
  const path = qs
    ? `/tenant/cx-agents/sales-events?${qs}`
    : '/tenant/cx-agents/sales-events';
  const res = await fetch(getApiUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
