/**
 * GET /api/auth/events
 *
 * Returns the most recent N auth_events rows for the authenticated user
 * (sign-ins + sensitive operations). Powers the Recent Activity panel
 * in the Settings drawer.
 *
 * Auth: Bearer JWT, re-verified server-side via getAuthInfoFromRequest.
 * The query both runs under the user's identity (RLS) and filters
 * explicitly by user_id — defense in depth so a future RLS misconfig
 * cannot leak another user's audit trail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromRequest } from '../../../../src/lib/auth-helper';
import { createAuthenticatedSupabaseClient } from '../../../../src/lib/supabaseAuthClient';
import { logger } from '../../../../src/lib/logger';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authInfo = await getAuthInfoFromRequest(request);
  if (!authInfo || !authInfo.userId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { userId, accessToken } = authInfo;

  // Parse limit. Cap at MAX_LIMIT so a curious client can't ask for the
  // whole table.
  const limitParam = request.nextUrl.searchParams.get('limit');
  let limit = DEFAULT_LIMIT;
  if (limitParam) {
    const n = Number.parseInt(limitParam, 10);
    if (Number.isFinite(n) && n > 0) {
      limit = Math.min(n, MAX_LIMIT);
    }
  }

  try {
    const supabase = await createAuthenticatedSupabaseClient(accessToken);
    const { data, error } = await supabase
      .from('auth_events')
      .select('id, event_type, ua_summary, region, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      logger.warn('GET /api/auth/events failed:', error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    return NextResponse.json({ ok: true, events: data ?? [] });
  } catch (err) {
    logger.error('GET /api/auth/events threw:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
