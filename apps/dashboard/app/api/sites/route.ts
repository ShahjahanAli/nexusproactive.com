import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, getApiUrl } from '@/lib/config';
import { buildEmbedSnippet } from '@/lib/embed-snippet';
import { getPublicApiUrl } from '@/lib/public-api-url';

async function proxyRequest(request: NextRequest, path: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(getApiUrl(path), {
    method: request.method,
    headers,
    body: request.method !== 'GET' ? await request.text() : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function GET() {
  return proxyRequest(new NextRequest(getApiUrl('/sites')), '/sites');
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(getApiUrl('/sites'), {
    method: 'POST',
    headers,
    body: await request.text(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const siteId = data.site?.id as string | undefined;
  const publicApiUrl = getPublicApiUrl();

  return NextResponse.json({
    ...data,
    publicApiUrl,
    embedSnippet: siteId ? buildEmbedSnippet(siteId, publicApiUrl) : undefined,
  });
}
