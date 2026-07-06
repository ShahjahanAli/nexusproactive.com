import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, getApiUrl } from '@/lib/config';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ visitorId: string }> },
) {
  const { visitorId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(getApiUrl(`/visitors/${encodeURIComponent(visitorId)}/memories`), {
    method: 'POST',
    headers,
    body: await request.text(),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
