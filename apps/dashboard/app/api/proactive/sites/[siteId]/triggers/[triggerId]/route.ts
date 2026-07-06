import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, getApiUrl } from '@/lib/config';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ siteId: string; triggerId: string }> },
) {
  const { siteId, triggerId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(getApiUrl(`/proactive/sites/${siteId}/triggers/${triggerId}`), {
    method: 'DELETE',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
