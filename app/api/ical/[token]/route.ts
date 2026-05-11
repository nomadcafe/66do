import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabaseClient } from '../../../../src/lib/supabaseServiceRoleClient';
import { buildIcalFeed, type IcalDomain } from '../../../../src/lib/buildIcalFeed';
import { checkIcalTokenRateLimit } from '../../../../src/lib/rateLimit';
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

// UUIDv4 / v5 form: 8-4-4-4-12 lowercase hex. crypto.randomUUID() emits
// canonical lowercase; we accept either case to be lenient about URL
// rewrites but reject anything that isn't a UUID shape so scanners hitting
// /api/ical/<random> short-circuit before touching the DB or rate limiter.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  if (!token || typeof token !== 'string' || !UUID_REGEX.test(token)) {
    return new NextResponse('Not found', { status: 404 });
  }

  // IP throttle before DB lookup so scanners can't free-ride on the Postgres
  // query path. Brute-forcing the UUID itself is infeasible; this is about
  // log/noise/DoS, not secret strength.
  const ip = getClientIp(_req);
  const rl = await checkIcalTokenRateLimit(ip);
  if (rl.limited) {
    return new NextResponse(
      rl.reason === 'backend' ? 'Service unavailable' : 'Too many requests',
      { status: rl.reason === 'backend' ? 503 : 429 },
    );
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

  const userId = userResult.data.id;

  const domainsResult = await (supabase
    .from('domains')
    .select('id, domain_name, registrar, status, expiry_date, next_renewal_date, purchase_date, renewal_cycle, renewal_count')
    .eq('user_id', userId) as unknown as Promise<{
      data: IcalDomain[] | null;
      error: { message: string } | null;
    }>);

  if (domainsResult.error) {
    serverLogger.error('iCal route: domains query failed', domainsResult.error);
    return new NextResponse('Service unavailable', { status: 503 });
  }

  const domains: IcalDomain[] = domainsResult.data ?? [];

  // Fire-and-forget last-used audit write. We don't await — calendar clients
  // poll on a tight loop and waiting on an extra round-trip hurts feed
  // latency without changing the user-facing experience. Errors get logged
  // and the feed still serves.
  void (supabase
    .from('users')
    .update({
      ical_last_used_at: new Date().toISOString(),
      ical_last_used_ip: ip,
    } as never)
    .eq('id', userId) as unknown as Promise<{ error: { message: string } | null }>)
    .then((res) => {
      if (res.error) {
        serverLogger.error('iCal route: last-used audit write failed', res.error);
      }
    });

  return new NextResponse(buildIcalFeed({ domains }), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // The URL token IS the credential. `no-store` keeps the body out of
      // every cache (browser, CDN edge, corporate proxy) — a cached response
      // is itself a credential leak vector if the URL surfaces anywhere it
      // shouldn't. Calendar clients honour their own poll cadence and don't
      // need HTTP caching to behave well here.
      'Cache-Control': 'no-store',
      // Hint a filename for clients that download instead of subscribing.
      'Content-Disposition': 'inline; filename="domain-renewals.ics"',
    },
  });
}
