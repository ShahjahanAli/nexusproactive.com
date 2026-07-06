import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE = 'nexus_session';

export function proxy(request: NextRequest) {
  const session = request.cookies.get(AUTH_COOKIE);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/app') && !session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((pathname === '/login' || pathname === '/signup') && session) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/login', '/signup'],
};
