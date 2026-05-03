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

// 同一 user + 同一 event_type 在这个窗口内的重复写入会被跳过。
// 真实场景：magic-link 登录时 /auth/callback 与 /auth/magic-link 两个页面
// 都会调 fireSignInNotification（detectSessionInUrl 让两个回调路径都触发），
// 间隔 ~1 秒。5 秒窗口足够吸收这种 UI 层的双触发，又不会遮盖真实的"用户在
// 5 秒内连续登录两次"——后者罕见到可以接受。
const AUTH_EVENT_DEDUP_WINDOW_SECONDS = 5;

async function record(
  user: AuthUser,
  eventType: 'sign_in' | SensitiveOpEvent,
  request: Request
): Promise<void> {
  try {
    const signals = readRequestSignals(request.headers);
    const ua = summarizeUA(signals.userAgent);
    const supabase = createServiceRoleSupabaseClient();

    // Best-effort dedup：先查同 user + 同 event 在窗口内是否已有记录，有则
    // 跳过 insert。竞态窗口（两个并发请求都通过 SELECT 后再各自 INSERT）
    // 在毫秒级，不做更强的原子性保证——这是 cosmetic dedup，多写一条也
    // 不会造成数据损坏，只是 UI 上多一行。
    const dedupSince = new Date(Date.now() - AUTH_EVENT_DEDUP_WINDOW_SECONDS * 1000).toISOString();
    const { data: recent, error: recentError } = await supabase
      .from('auth_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_type', eventType)
      .gte('created_at', dedupSince)
      .limit(1);
    if (recentError) {
      // 查询失败时降级：继续 insert，不让 dedup 检查反而阻塞正常记录。
      logger.warn('auth_events dedup lookup failed:', recentError.message);
    } else if (recent && recent.length > 0) {
      // 已有最近记录，跳过本次写入。
      return;
    }

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
