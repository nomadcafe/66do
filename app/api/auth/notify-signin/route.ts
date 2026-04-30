/**
 * POST /api/auth/notify-signin
 *
 * Called by the client immediately after a successful auth callback
 * (`setSession` or `verifyOtp`). Records a row in auth_events so the
 * user can review their sign-in history from the dashboard's Recent
 * Activity panel. Server-trusted UA + Vercel geo headers (read here)
 * cannot be fabricated by the client.
 *
 * Auth: Bearer JWT in Authorization header. We re-verify via Supabase
 * to avoid trusting a forged token.
 *
 * Failure mode: always returns 200 on success or 401 on missing auth.
 * DB write failures are logged but do not bubble — the client has
 * already redirected to /dashboard by the time it fires this off, and
 * a flaky audit pipeline must not surface as an error toast.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recordSignIn } from '../../../../src/lib/securityEvents';
import { logger } from '../../../../src/lib/logger';

export const runtime = 'nodejs';

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
  if (error || !data?.user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Fire and forget — recordSignIn handles its own errors.
  await recordSignIn({ id: data.user.id }, request);
  return NextResponse.json({ ok: true });
}
