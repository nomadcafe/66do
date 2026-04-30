/**
 * GET /api/auth/events
 *
 * Returns the most recent N auth_events rows for the authenticated user
 * (sign-ins + sensitive operations). Powers the Recent Activity panel
 * in the Settings drawer.
 *
 * Auth: Bearer JWT. The query runs under the user's identity via the
 * authenticated client, so RLS enforces tenant isolation — even if a
 * code path here ever neglected to filter by user_id, the database
 * would refuse rows that don't belong to the caller.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedSupabaseClient } from '../../../../src/lib/supabaseAuthClient';
import { logger } from '../../../../src/lib/logger';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const token = authHeader.substring(7);

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
    const supabase = await createAuthenticatedSupabaseClient(token);
    const { data, error } = await supabase
      .from('auth_events')
      .select('id, event_type, ua_summary, region, created_at')
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
