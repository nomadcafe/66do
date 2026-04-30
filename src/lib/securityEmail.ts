/**
 * Security notification emails: sign-in alerts + sensitive-operation alerts.
 *
 * Design constraints:
 *   1. Never block the auth flow. Email send failures must NOT prevent
 *      sign-in or any user-visible action; they degrade silently to a
 *      logger.error call.
 *   2. Honest "no detection" framing — we don't pretend to identify "new
 *      devices." Every successful sign-in sends an email by default; the
 *      24h dedupe just suppresses duplicates from the same UA so the user
 *      isn't spammed by their daily browser-relaunch.
 *   3. Privacy floor — we never persist raw IP. Vercel's edge already
 *      gives us city/country level, which is what users see in the email
 *      and what we record in auth_events. Raw UA is hashed for dedupe;
 *      the human-readable summary is what we keep + show.
 *   4. Locale-aware — body language follows the user's last-known locale
 *      cookie, falling back to English.
 */

import { createHash } from 'crypto';
import { Resend } from 'resend';
import { UAParser } from 'ua-parser-js';
import { createServiceRoleSupabaseClient } from './supabaseServiceRoleClient';
import { logger } from './logger';

export type SensitiveOpEvent =
  | 'data_export'
  | 'email_change'
  | 'account_delete'
  | 'oauth_unbind';

const FROM_ADDRESS = process.env.SECURITY_EMAIL_FROM ?? 'Domain.Financial <security@domain.financial>';
const SIGNIN_DEDUPE_WINDOW_HOURS = 24;

// Lazy singleton — Resend constructor is cheap, but we still want to fail
// loudly if the key is missing on first send rather than at module load.
let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.warn('RESEND_API_KEY not set — security emails disabled');
    return null;
  }
  resendClient = new Resend(key);
  return resendClient;
}

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
  // email subject + summary without helping the user identify the device.
  return { hash, summary: `${browser} on ${os}` };
}

interface AuthUser {
  id: string;
  email: string;
}

/**
 * Sign-in notification entry point. Called from /api/auth/notify-signin
 * after the client confirms its session is established.
 *
 * Returns silently regardless of outcome — auth flow must never fail
 * because the email pipeline is down. Errors are logged.
 */
export async function notifySignIn(
  user: AuthUser,
  request: Request,
  locale: 'zh' | 'en' = 'en'
): Promise<void> {
  try {
    const signals = readRequestSignals(request.headers);
    const ua = summarizeUA(signals.userAgent);
    const supabase = createServiceRoleSupabaseClient();

    // Dedupe — skip the email if the same UA hash already triggered a
    // delivered email for this user inside the rolling window. The DB
    // check matters more than the in-memory one because successive
    // requests from the same browser may come from different server
    // instances on Vercel.
    if (ua.hash) {
      const since = new Date(
        Date.now() - SIGNIN_DEDUPE_WINDOW_HOURS * 60 * 60 * 1000
      ).toISOString();
      const { data: prior, error: dedupeErr } = await supabase
        .from('auth_events')
        .select('id')
        .eq('user_id', user.id)
        .eq('event_type', 'sign_in')
        .eq('ua_hash', ua.hash)
        .eq('email_sent', true)
        .gte('created_at', since)
        .limit(1);
      if (dedupeErr) {
        logger.warn('auth_events dedupe query failed:', dedupeErr.message);
        // Fall through; better to risk a duplicate email than skip an
        // alert because of a transient DB error.
      } else if (prior && prior.length > 0) {
        // Still record the event so the user's "Recent activity" panel
        // (future) shows accurate sign-in count, but skip the email.
        // `as never` cast: Supabase typed client surfaces inserts as
        // `never` for this codebase's type setup — same workaround used
        // in supabaseService.ts (see line 79 there).
        await supabase.from('auth_events').insert({
          user_id: user.id,
          event_type: 'sign_in',
          ua_hash: ua.hash,
          ua_summary: ua.summary,
          region: signals.region,
          email_sent: false,
        } as never);
        return;
      }
    }

    const sent = await sendSignInEmail({
      to: user.email,
      uaSummary: ua.summary,
      region: signals.region,
      locale,
      when: new Date(),
    });

    await supabase.from('auth_events').insert({
      user_id: user.id,
      event_type: 'sign_in',
      ua_hash: ua.hash,
      ua_summary: ua.summary,
      region: signals.region,
      email_sent: sent,
    } as never);
  } catch (err) {
    logger.error('notifySignIn failed:', err);
  }
}

/**
 * Sensitive-op notification entry point. Same fail-soft posture as
 * notifySignIn. Sensitive ops do NOT dedupe — the user should see every
 * single one in real time.
 */
export async function notifySensitiveOp(
  user: AuthUser,
  event: SensitiveOpEvent,
  request: Request,
  locale: 'zh' | 'en' = 'en'
): Promise<void> {
  try {
    const signals = readRequestSignals(request.headers);
    const ua = summarizeUA(signals.userAgent);

    const sent = await sendSensitiveOpEmail({
      to: user.email,
      event,
      uaSummary: ua.summary,
      region: signals.region,
      locale,
      when: new Date(),
    });

    const supabase = createServiceRoleSupabaseClient();
    await supabase.from('auth_events').insert({
      user_id: user.id,
      event_type: event,
      ua_hash: ua.hash,
      ua_summary: ua.summary,
      region: signals.region,
      email_sent: sent,
    } as never);
  } catch (err) {
    logger.error('notifySensitiveOp failed:', err);
  }
}

// ─── Email rendering ──────────────────────────────────────────────────

interface SignInEmailArgs {
  to: string;
  uaSummary: string;
  region: string | null;
  locale: 'zh' | 'en';
  when: Date;
}

async function sendSignInEmail(args: SignInEmailArgs): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;
  const { subject, html, text } = renderSignInEmail(args);
  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: args.to,
      subject,
      html,
      text,
    });
    if (result.error) {
      logger.warn('Resend sign-in email error:', result.error.message);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('Resend sign-in email threw:', err);
    return false;
  }
}

interface SensitiveOpEmailArgs {
  to: string;
  event: SensitiveOpEvent;
  uaSummary: string;
  region: string | null;
  locale: 'zh' | 'en';
  when: Date;
}

async function sendSensitiveOpEmail(args: SensitiveOpEmailArgs): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;
  const { subject, html, text } = renderSensitiveOpEmail(args);
  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: args.to,
      subject,
      html,
      text,
    });
    if (result.error) {
      logger.warn('Resend sensitive-op email error:', result.error.message);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('Resend sensitive-op email threw:', err);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatWhen(when: Date, locale: 'zh' | 'en'): string {
  return when.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function renderSignInEmail(args: SignInEmailArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const isZh = args.locale === 'zh';
  const when = formatWhen(args.when, args.locale);
  const region = args.region ?? (isZh ? '未知地区' : 'Unknown region');

  const subject = isZh
    ? '您的 Domain.Financial 账号有新的登录'
    : 'New sign-in to your Domain.Financial account';

  const heading = isZh ? '账号有新的登录' : 'New sign-in detected';
  const lead = isZh
    ? '您的 Domain.Financial 账号在以下设备完成了登录：'
    : 'Your Domain.Financial account was just signed in to from:';
  const labelDevice = isZh ? '设备' : 'Device';
  const labelLocation = isZh ? '位置' : 'Location';
  const labelTime = isZh ? '时间' : 'Time';
  const ifNotYou = isZh
    ? '如果不是您本人操作，请立即登录账户、撤销其他会话，并修改 Google 账号或邮箱密码：'
    : 'If this wasn\'t you, sign in now, revoke other sessions, and change your Google account or email password:';
  const ctaText = isZh ? '前往账户设置' : 'Go to account settings';
  const ctaUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/dashboard?settings=open`
    : 'https://www.domain.financial/dashboard?settings=open';
  const dedupeNote = isZh
    ? '为减少打扰，同一设备 24 小时内只发送一次此邮件。'
    : 'To reduce noise, we only send this email once every 24 hours per device.';

  const html = `<!doctype html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
  <body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1917;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fafaf9;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 24px;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#0d9488;">Domain.Financial</p>
                <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1c1917;">${escapeHtml(heading)}</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#44403c;">${escapeHtml(lead)}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f4f0;border-radius:10px;padding:16px 20px;">
                  <tr><td style="padding:6px 0;font-size:13px;color:#78716c;width:90px;">${escapeHtml(labelDevice)}</td><td style="padding:6px 0;font-size:14px;color:#1c1917;font-weight:500;">${escapeHtml(args.uaSummary)}</td></tr>
                  <tr><td style="padding:6px 0;font-size:13px;color:#78716c;">${escapeHtml(labelLocation)}</td><td style="padding:6px 0;font-size:14px;color:#1c1917;font-weight:500;">${escapeHtml(region)}</td></tr>
                  <tr><td style="padding:6px 0;font-size:13px;color:#78716c;">${escapeHtml(labelTime)}</td><td style="padding:6px 0;font-size:14px;color:#1c1917;font-weight:500;">${escapeHtml(when)}</td></tr>
                </table>
                <p style="margin:24px 0 16px;font-size:14px;line-height:1.6;color:#44403c;">${escapeHtml(ifNotYou)}</p>
                <p style="margin:0 0 24px;">
                  <a href="${ctaUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;">${escapeHtml(ctaText)}</a>
                </p>
                <p style="margin:0;padding-top:20px;border-top:1px solid #e7e5e4;font-size:12px;line-height:1.6;color:#a8a29e;">${escapeHtml(dedupeNote)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = isZh
    ? `${heading}\n\n${lead}\n  ${labelDevice}: ${args.uaSummary}\n  ${labelLocation}: ${region}\n  ${labelTime}: ${when}\n\n${ifNotYou}\n${ctaUrl}\n\n${dedupeNote}\n`
    : `${heading}\n\n${lead}\n  ${labelDevice}: ${args.uaSummary}\n  ${labelLocation}: ${region}\n  ${labelTime}: ${when}\n\n${ifNotYou}\n${ctaUrl}\n\n${dedupeNote}\n`;

  return { subject, html, text };
}

const SENSITIVE_OP_COPY: Record<
  SensitiveOpEvent,
  { zh: { subject: string; heading: string; lead: string }; en: { subject: string; heading: string; lead: string } }
> = {
  data_export: {
    zh: {
      subject: '您的 Domain.Financial 数据已导出',
      heading: '数据导出已触发',
      lead: '您的账户刚刚导出了一份数据副本。如果不是您本人操作，您的账户可能已被未授权访问。',
    },
    en: {
      subject: 'Your Domain.Financial data was just exported',
      heading: 'Data export triggered',
      lead: 'A copy of your account data was just exported. If this wasn\'t you, your account may have been compromised.',
    },
  },
  email_change: {
    zh: {
      subject: '您的 Domain.Financial 登录邮箱被修改',
      heading: '登录邮箱已修改',
      lead: '您账户的登录邮箱刚刚被修改。如果不是您本人操作，请立即联系我们以恢复账户访问。',
    },
    en: {
      subject: 'Your Domain.Financial sign-in email was changed',
      heading: 'Sign-in email changed',
      lead: 'The sign-in email on your account was just changed. If this wasn\'t you, contact us immediately to recover access.',
    },
  },
  account_delete: {
    zh: {
      subject: '您的 Domain.Financial 账号已被删除',
      heading: '账号已删除',
      lead: '您的账户刚刚被请求删除。如果不是您本人操作，请立即联系我们尝试恢复（数据有短暂的保留窗口）。',
    },
    en: {
      subject: 'Your Domain.Financial account was deleted',
      heading: 'Account deletion requested',
      lead: 'A deletion request was just made on your account. If this wasn\'t you, contact us immediately — there is a brief recovery window.',
    },
  },
  oauth_unbind: {
    zh: {
      subject: '您的 Domain.Financial 账号 OAuth 绑定有变化',
      heading: 'OAuth 绑定已修改',
      lead: '您账户的 Google 等第三方登录绑定刚刚被修改。如果不是您本人操作，请立即检查账户安全。',
    },
    en: {
      subject: 'OAuth binding on your Domain.Financial account changed',
      heading: 'OAuth binding changed',
      lead: 'A third-party sign-in binding (e.g., Google) on your account was just changed. If this wasn\'t you, review your account security now.',
    },
  },
};

function renderSensitiveOpEmail(args: SensitiveOpEmailArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const isZh = args.locale === 'zh';
  const copy = SENSITIVE_OP_COPY[args.event][isZh ? 'zh' : 'en'];
  const when = formatWhen(args.when, args.locale);
  const region = args.region ?? (isZh ? '未知地区' : 'Unknown region');
  const labelDevice = isZh ? '设备' : 'Device';
  const labelLocation = isZh ? '位置' : 'Location';
  const labelTime = isZh ? '时间' : 'Time';
  const contactCta = isZh ? '联系我们' : 'Contact us';
  const supportUrl = 'mailto:hello@domain.financial';

  const html = `<!doctype html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
  <body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1917;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fafaf9;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #fecaca;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#fef2f2;padding:14px 32px;border-bottom:1px solid #fecaca;">
                <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#b91c1c;">${isZh ? '安全提醒' : 'Security alert'}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;">
                <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#1c1917;">${escapeHtml(copy.heading)}</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#44403c;">${escapeHtml(copy.lead)}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f4f0;border-radius:10px;padding:16px 20px;">
                  <tr><td style="padding:6px 0;font-size:13px;color:#78716c;width:90px;">${escapeHtml(labelDevice)}</td><td style="padding:6px 0;font-size:14px;color:#1c1917;font-weight:500;">${escapeHtml(args.uaSummary)}</td></tr>
                  <tr><td style="padding:6px 0;font-size:13px;color:#78716c;">${escapeHtml(labelLocation)}</td><td style="padding:6px 0;font-size:14px;color:#1c1917;font-weight:500;">${escapeHtml(region)}</td></tr>
                  <tr><td style="padding:6px 0;font-size:13px;color:#78716c;">${escapeHtml(labelTime)}</td><td style="padding:6px 0;font-size:14px;color:#1c1917;font-weight:500;">${escapeHtml(when)}</td></tr>
                </table>
                <p style="margin:24px 0 0;">
                  <a href="${supportUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;">${escapeHtml(contactCta)}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${copy.heading}\n\n${copy.lead}\n  ${labelDevice}: ${args.uaSummary}\n  ${labelLocation}: ${region}\n  ${labelTime}: ${when}\n\n${contactCta}: ${supportUrl}\n`;

  return { subject: copy.subject, html, text };
}
