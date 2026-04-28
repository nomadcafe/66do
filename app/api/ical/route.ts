import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromRequest } from '../../../src/lib/auth-helper';
import { createServiceRoleSupabaseClient } from '../../../src/lib/supabaseServiceRoleClient';
import { getCorsHeaders, getCorsHeadersForError, noCacheHeaders } from '../../../src/lib/cors';
import { serverLogger } from '../../../src/lib/logger';

/**
 * GET  /api/ical → returns the current user's ical_token, generating one
 *                  lazily if absent. Powers the "Subscribe" card in
 *                  Settings drawer.
 * POST /api/ical → regenerates the token, invalidating any previously
 *                  shared subscription URL. Used by the "Regenerate"
 *                  button when a user thinks the URL has leaked.
 *
 * Both require a valid auth Bearer; both write through the service-role
 * client to bypass RLS (the user_id we trust comes from the verified
 * Bearer, not from the request body).
 */

async function readOrCreateToken(userId: string, force: boolean): Promise<string | null> {
  const supabase = createServiceRoleSupabaseClient();

  // Type assertions follow the project-wide pattern (see supabaseService.ts)
  // because Supabase's TS inference loses the row shape on .eq().maybeSingle().
  if (!force) {
    const { data, error } = await (supabase
      .from('users')
      .select('ical_token')
      .eq('id', userId)
      .maybeSingle() as unknown as Promise<{
        data: { ical_token: string | null } | null;
        error: { message: string } | null;
      }>);
    if (error) {
      serverLogger.error('iCal token read failed', error);
      return null;
    }
    if (data?.ical_token) return data.ical_token;
  }

  const newToken = crypto.randomUUID();
  // `as never` matches the project-wide workaround in supabaseService.ts
  // for Supabase's update payload typing limitation.
  const { error: updErr } = await (supabase
    .from('users')
    .update({ ical_token: newToken, updated_at: new Date().toISOString() } as never)
    .eq('id', userId) as unknown as Promise<{
      error: { message: string } | null;
    }>);
  if (updErr) {
    serverLogger.error('iCal token write failed', updErr);
    return null;
  }
  return newToken;
}

export async function GET(request: NextRequest) {
  const corsHeaders = { ...getCorsHeaders(request), ...noCacheHeaders };
  try {
    const auth = await getAuthInfoFromRequest(request);
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    const token = await readOrCreateToken(auth.userId, false);
    if (!token) {
      return NextResponse.json({ error: 'Failed to load token' }, { status: 500, headers: corsHeaders });
    }
    return NextResponse.json({ token }, { headers: corsHeaders });
  } catch (err) {
    serverLogger.error('iCal GET failed', err);
    return NextResponse.json({ error: 'Internal server error' }, {
      status: 500,
      headers: getCorsHeadersForError(),
    });
  }
}

export async function POST(request: NextRequest) {
  const corsHeaders = { ...getCorsHeaders(request), ...noCacheHeaders };
  try {
    const auth = await getAuthInfoFromRequest(request);
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    const token = await readOrCreateToken(auth.userId, true);
    if (!token) {
      return NextResponse.json({ error: 'Failed to regenerate token' }, { status: 500, headers: corsHeaders });
    }
    return NextResponse.json({ token }, { headers: corsHeaders });
  } catch (err) {
    serverLogger.error('iCal POST failed', err);
    return NextResponse.json({ error: 'Internal server error' }, {
      status: 500,
      headers: getCorsHeadersForError(),
    });
  }
}
