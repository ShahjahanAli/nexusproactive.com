import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, getApiUrl } from '@/lib/config';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  const res = await fetch(getApiUrl(`/conversations/${id}/messages`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
