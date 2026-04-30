/**
 * Server-side recording of security-sensitive auth events. Reads UA + Vercel
 * geo headers from the incoming request, summarises them, and writes a row
 * to auth_events. The user reviews these events in the dashboard's Settings
 * drawer (Recent Activity panel) — there is no email pipeline.
 *
 * Design constraints:
 *   1. Never block the auth flow. DB write failures must NOT prevent
 *      sign-in or any user-visible action; they degrade silently to a
 *      logger.error call.
 *   2. Privacy floor — we never persist raw IP. Vercel's edge already
 *      gives us city/country level, which is what we record. Raw UA is
 *      hashed (in case a future feature wants per-device dedupe in a
 *      separate context), and the human-readable summary is what the
 *      Settings UI shows.
 */

import { createHash } from 'crypto';
import { UAParser } from 'ua-parser-js';
import { createServiceRoleSupabaseClient } from './supabaseServiceRoleClient';
import { logger } from './logger';

export type SensitiveOpEvent =
  | 'data_export'
  | 'email_change'
  | 'account_delete'
  | 'oauth_unbind';

interface RequestSignals {
  userAgent: string | null;
  region: string | null;
}

/**
 * Pull what we need from request headers. Region prefers Vercel's edge
 * geo headers (already coarsened to city level by Vercel), falling back
 * to country-only or null. We never read raw IP — even though Vercel
 * exposes x-forwarded-for, persisting it would expand our PII surface
 * for no UX gain (the city is what the user actually wants to see).
 */
export function readRequestSignals(headers: Headers): RequestSignals {
  const userAgent = headers.get('user-agent');
  const country = headers.get('x-vercel-ip-country');
  const city = headers.get('x-vercel-ip-city');
  let region: string | null = null;
  if (city && country) {
    // Vercel sends URL-encoded city names (e.g., "San%20Francisco"). Decode
    // for display; ignore decode failures (raw form is also legible).
    try {
      region = `${decodeURIComponent(city)}, ${country}`;
    } catch {
      region = `${city}, ${country}`;
    }
  } else if (country) {
    region = country;
  }
  return { userAgent: userAgent ?? null, region };
}

interface UAInfo {
  hash: string | null;
  summary: string;
}

function summarizeUA(ua: string | null): UAInfo {
  if (!ua) return { hash: null, summary: 'Unknown device' };
  const hash = createHash('sha256').update(ua).digest('hex');
  const parsed = new UAParser(ua).getResult();
  const browser = parsed.browser.name ?? 'Unknown browser';
  const os = parsed.os.name ?? 'Unknown OS';
  // Skip browser version — they update too frequently and pollute the
  // history list without helping the user identify the device.
  return { hash, summary: `${browser} on ${os}` };
}

interface AuthUser {
  id: string;
}

/**
 * Sign-in event recording. Called from /api/auth/notify-signin after the
 * client confirms its session is established. No dedupe — every sign-in
 * is recorded so the user's history shows every login attempt; that's
 * the security signal (an attacker's session would otherwise be invisible
 * if it shared a UA with the legitimate user).
 *
 * Returns silently regardless of outcome — auth flow must never fail
 * because event recording is down. Errors are logged.
 */
export async function recordSignIn(
  user: AuthUser,
  request: Request
): Promise<void> {
  await record(user, 'sign_in', request);
}

/**
 * Sensitive-op recording. Same fail-soft posture as recordSignIn.
 */
export async function recordSensitiveOp(
  user: AuthUser,
  event: SensitiveOpEvent,
  request: Request
): Promise<void> {
  await record(user, event, request);
}

async function record(
  user: AuthUser,
  eventType: 'sign_in' | SensitiveOpEvent,
  request: Request
): Promise<void> {
  try {
    const signals = readRequestSignals(request.headers);
    const ua = summarizeUA(signals.userAgent);
    const supabase = createServiceRoleSupabaseClient();
    // `as never` cast: Supabase typed client surfaces inserts as `never`
    // for this codebase's type setup — same workaround used in
    // supabaseService.ts (see line 79 there).
    const { error } = await supabase.from('auth_events').insert({
      user_id: user.id,
      event_type: eventType,
      ua_hash: ua.hash,
      ua_summary: ua.summary,
      region: signals.region,
    } as never);
    if (error) {
      logger.warn('auth_events insert failed:', error.message);
    }
  } catch (err) {
    logger.error('record auth event failed:', err);
  }
}
