import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { LOCALE_COOKIE } from './src/i18n/homeDictionary';

function resolveRedirectLocale(request: NextRequest): 'zh' | 'en' {
  const c = request.cookies.get(LOCALE_COOKIE)?.value;
  if (c === 'zh' || c === 'en') return c;
  const al = request.headers.get('accept-language')?.toLowerCase() || '';
  if (al.startsWith('zh')) return 'zh';
  return 'en';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }

  if (/\.(ico|png|jpg|jpeg|svg|gif|webp|txt|xml|json|webmanifest)$/i.test(pathname)) {
    return NextResponse.next();
  }

  const prefixed = pathname.match(/^\/(zh|en)(\/|$)/);
  if (prefixed) {
    const loc = prefixed[1] as 'zh' | 'en';
    const reqHeaders = new Headers(request.headers);
    reqHeaders.set('x-path-locale', loc);
    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.cookies.set(LOCALE_COOKIE, loc, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    });
    return res;
  }

  if (pathname === '/') {
    const loc = resolveRedirectLocale(request);
    return NextResponse.redirect(new URL(`/${loc}`, request.url));
  }

  if (pathname === '/changelog' || pathname === '/privacy') {
    const loc = resolveRedirectLocale(request);
    return NextResponse.redirect(new URL(`/${loc}${pathname}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|webmanifest)$).*)',
  ],
};
