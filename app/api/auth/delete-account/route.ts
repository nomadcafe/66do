/**
 * POST /api/auth/delete-account
 *
 * Deletes the authenticated user's account and all their data. One-way door:
 * after this returns 200 the client must sign out and redirect.
 *
 * Cascade strategy:
 *   1. Record an `account_delete` audit event first. The row will be cascaded
 *      away in step 3 — but a) it costs ~nothing and b) it lights up the
 *      Recent Activity panel for any concurrent session the user has open in
 *      another tab before the auth.users delete drops the JWT, giving them a
 *      last-moment "wait, was this me?" signal.
 *   2. Explicit `delete from public.users where id = ?` — the mirror table
 *      isn't covered by the auth.users CASCADE (we needed manual cleanup of
 *      both sides during the 2026-05-03 dead-user pass for the same reason).
 *   3. `supabase.auth.admin.deleteUser(userId)` — this nukes the auth.users
 *      row, which cascades to domains, domain_transactions, auth_events, and
 *      installment_receipts (all confirmed CASCADE in the 2026-05-03 audit).
 *
 * Order matters: deleting public.users before auth.users avoids any chance
 * of a FK pointing the other way (public.users.id → auth.users.id) blocking
 * the auth delete on rows that haven't been mirrored yet. If public.users
 * has no row for this user, the delete is a no-op.
 *
 * Auth: Bearer JWT, re-verified server-side. Same pattern as the other
 * notify-* routes — never trust a client-supplied user id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServiceRoleSupabaseClient } from '../../../../src/lib/supabaseServiceRoleClient';
import { recordSensitiveOp } from '../../../../src/lib/securityEvents';
import { checkUserWriteRateLimit } from '../../../../src/lib/rateLimit';
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
    logger.error('delete-account: Supabase env vars missing');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const verifier = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: verifyError } = await verifier.auth.getUser(token);
  if (verifyError || !userData?.user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const userId = userData.user.id;

  // Account deletion is a write operation, so use the write limiter (not the
  // audit limiter) — the latter fails closed and would silently drop the
  // request, leaving the user staring at a spinner.
  const rl = await checkUserWriteRateLimit(userId);
  if (rl.limited) {
    return NextResponse.json(
      { ok: false, error: rl.reason === 'rate' ? 'rate_limited' : 'backend_unavailable' },
      { status: rl.reason === 'rate' ? 429 : 503 }
    );
  }

  // Step 1: audit before deletion. Fire-and-forget — a failed write here
  // must not block the actual deletion the user requested.
  await recordSensitiveOp({ id: userId }, 'account_delete', request);

  const admin = createServiceRoleSupabaseClient();

  // Step 2: explicit public.users cleanup. Failures here are logged but
  // don't abort — the auth.admin.deleteUser call is the load-bearing step,
  // and a leftover orphan in public.users is recoverable (we ran a manual
  // cleanup before; see ROADMAP 2026-05-03).
  const { error: profileDeleteError } = await admin.from('users').delete().eq('id', userId);
  if (profileDeleteError) {
    logger.warn('delete-account: public.users delete failed:', profileDeleteError.message);
  }

  // Step 3: the load-bearing call. Cascade handles domains / domain_transactions /
  // auth_events / installment_receipts via their FK to auth.users.
  const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    logger.error('delete-account: auth.admin.deleteUser failed:', authDeleteError.message);
    return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
