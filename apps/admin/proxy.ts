import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PLATFORM_AUTH_COOKIE = 'nexus_platform_session';

export function proxy(request: NextRequest) {
  const session = request.cookies.get(PLATFORM_AUTH_COOKIE);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') && !session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(session ? '/admin' : '/login', request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*', '/login'],
};
