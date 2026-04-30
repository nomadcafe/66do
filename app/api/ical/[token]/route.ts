import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabaseClient } from '../../../../src/lib/supabaseServiceRoleClient';
import { buildIcalFeed, type IcalDomain } from '../../../../src/lib/buildIcalFeed';
import { serverLogger } from '../../../../src/lib/logger';

/**
 * GET /api/ical/[token]
 *
 * Public endpoint (no auth header) returning the user's renewal-event
 * iCalendar feed. Authorisation is solely via the opaque token in the
 * URL path; the dashboard's IcalSubscriptionCard generates and shares
 * this URL, and a "regenerate" action invalidates leaked tokens.
 *
 * The route uses the Supabase service-role key to bypass RLS for the
 * lookup-by-token query. We never accept user-controlled SQL: the
 * token is matched verbatim and read-only data is returned.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  // Sanity-check the token shape before hitting the DB to avoid log noise
  // from random scanners. UUID v4 has a fixed 36-char layout.
  if (!token || typeof token !== 'string' || token.length < 16 || token.length > 64) {
    return new NextResponse('Not found', { status: 404 });
  }

  let supabase: ReturnType<typeof createServiceRoleSupabaseClient>;
  try {
    supabase = createServiceRoleSupabaseClient();
  } catch (err) {
    serverLogger.error('iCal route: service-role client init failed', err);
    return new NextResponse('Service unavailable', { status: 503 });
  }

  // Look up the user by token. Single-row query; no leakage if not found.
  // Type assertions follow the project-wide pattern (see supabaseService.ts) —
  // Supabase's TS inference loses the row shape through .select().eq() chains.
  const userResult = await (supabase
    .from('users')
    .select('id')
    .eq('ical_token', token)
    .maybeSingle() as unknown as Promise<{
      data: { id: string } | null;
      error: { message: string } | null;
    }>);

  if (userResult.error) {
    serverLogger.error('iCal route: user lookup failed', userResult.error);
    return new NextResponse('Service unavailable', { status: 503 });
  }
  if (!userResult.data) {
    return new NextResponse('Not found', { status: 404 });
  }

  const domainsResult = await (supabase
    .from('domains')
    .select('id, domain_name, registrar, status, expiry_date, next_renewal_date, purchase_date, renewal_cycle, renewal_count')
    .eq('user_id', userResult.data.id) as unknown as Promise<{
      data: IcalDomain[] | null;
      error: { message: string } | null;
    }>);

  if (domainsResult.error) {
    serverLogger.error('iCal route: domains query failed', domainsResult.error);
    return new NextResponse('Service unavailable', { status: 503 });
  }

  const domains: IcalDomain[] = domainsResult.data ?? [];

  const ics = buildIcalFeed({ domains });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // Calendar clients poll regularly; a 1-hour cache cuts server load
      // without making "I just renewed" feel stale for too long.
      // `private` keeps shared caches (corporate proxies / CDN edges) from
      // storing the body — the URL token is the only auth, so a cached
      // response is itself a credential leak vector if the URL surfaces
      // anywhere it shouldn't.
      'Cache-Control': 'private, max-age=3600',
      // Hint a filename for clients that download instead of subscribing.
      'Content-Disposition': 'inline; filename="domain-renewals.ics"',
    },
  });
}
