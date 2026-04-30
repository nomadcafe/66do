/**
 * POST /api/auth/notify-signin
 *
 * Called by the client immediately after a successful auth callback
 * (`setSession` or `verifyOtp`). The client can't talk to Resend (API
 * key is server-only) and we need server-trusted UA / Vercel geo
 * headers anyway.
 *
 * Auth: Bearer JWT in Authorization header. We re-verify via Supabase
 * to avoid trusting a forged token.
 *
 * Failure mode: this endpoint always returns 200 (or 401 on missing
 * auth). Email send failures are logged but do not bubble — the client
 * has already redirected to /dashboard by the time it fires this off,
 * and a flaky email pipeline must not surface as an error toast.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifySignIn } from '../../../../src/lib/securityEmail';
import { logger } from '../../../../src/lib/logger';

export const runtime = 'nodejs';

function pickLocale(request: NextRequest): 'zh' | 'en' {
  // Locale comes from the cookie set by HomeHeaderClient / useI18n; if
  // missing, fall back to Accept-Language country hint, then English.
  const cookie = request.cookies.get('domain_financial_locale')?.value;
  if (cookie === 'zh' || cookie === 'en') return cookie;
  const accept = request.headers.get('accept-language') ?? '';
  if (accept.toLowerCase().startsWith('zh')) return 'zh';
  return 'en';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const token = authHeader.substring(7);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    logger.error('notify-signin: Supabase env vars missing');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Per-call non-persisting client — same pattern as auth-helper.ts.
  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user || !data.user.email) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Fire the notification. notifySignIn handles dedupe + recording the
  // event itself, and never throws (errors are logged internally).
  await notifySignIn(
    { id: data.user.id, email: data.user.email },
    request,
    pickLocale(request)
  );

  return NextResponse.json({ ok: true });
}
