import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PLATFORM_AUTH_COOKIE, getApiUrl } from '@/lib/config';

async function proxy(request: NextRequest, pathSuffix: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(PLATFORM_AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const target = `${getApiUrl(`/platform${pathSuffix}`)}${url.search}`;

  const init: RequestInit = {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  const res = await fetch(target, init);
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(request, `/${path.join('/')}`);
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(request, `/${path.join('/')}`);
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(request, `/${path.join('/')}`);
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(request, `/${path.join('/')}`);
}
