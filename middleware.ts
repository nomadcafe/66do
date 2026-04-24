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

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function buildCspHeader(nonce: string): string {
  const isProduction = process.env.NODE_ENV === 'production';
  // Dev build uses eval for HMR. In production Next.js output plus our
  // deps (supabase-js, recharts, lucide-react, upstash) don't use eval.
  // strict-dynamic lets scripts loaded by trusted scripts run without
  // each needing its own nonce -- required for Next.js hydration chunks.
  const scriptSrc = isProduction
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // style-src keeps unsafe-inline because next/font and styled-jsx emit
    // inline <style> tags. Inline styles can't execute code, so the risk
    // is much lower than for scripts.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.in",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
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

  const nonce = generateNonce();
  const csp = buildCspHeader(nonce);

  const prefixed = pathname.match(/^\/(zh|en)(\/|$)/);
  if (prefixed) {
    const loc = prefixed[1] as 'zh' | 'en';
    const reqHeaders = new Headers(request.headers);
    reqHeaders.set('x-path-locale', loc);
    reqHeaders.set('x-nonce', nonce);
    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.cookies.set(LOCALE_COOKIE, loc, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    });
    res.headers.set('Content-Security-Policy', csp);
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

  const reqHeaders = new Headers(request.headers);
  reqHeaders.set('x-nonce', nonce);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|webmanifest)$).*)',
  ],
};
