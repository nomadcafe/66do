/**
 * POST /api/auth/notify-sensitive
 * Body: { event: 'data_export' | 'email_change' | 'account_delete' | 'oauth_unbind' }
 *
 * Fired by the client when it triggers a sensitive operation that
 * already lives client-side (data_export today, future email_change /
 * account_delete / oauth_unbind once those flows exist).
 *
 * Same fail-soft contract as /notify-signin: errors are logged, never
 * surfaced. A failed email must not block the user's data export.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifySensitiveOp, type SensitiveOpEvent } from '../../../../src/lib/securityEmail';
import { logger } from '../../../../src/lib/logger';

export const runtime = 'nodejs';

const VALID_EVENTS: readonly SensitiveOpEvent[] = [
  'data_export',
  'email_change',
  'account_delete',
  'oauth_unbind',
];

function pickLocale(request: NextRequest): 'zh' | 'en' {
  const cookie = request.cookies.get('domain_financial_locale')?.value;
  if (cookie === 'zh' || cookie === 'en') return cookie;
  const accept = request.headers.get('accept-language') ?? '';
  if (accept.toLowerCase().startsWith('zh')) return 'zh';
  return 'en';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const token = authHeader.substring(7);

  let body: { event?: string };
  try {
    body = (await request.json()) as { event?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  const event = body.event as SensitiveOpEvent | undefined;
  if (!event || !VALID_EVENTS.includes(event)) {
    return NextResponse.json({ ok: false, error: 'invalid_event' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    logger.error('notify-sensitive: Supabase env vars missing');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user || !data.user.email) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await notifySensitiveOp(
    { id: data.user.id, email: data.user.email },
    event,
    request,
    pickLocale(request)
  );

  return NextResponse.json({ ok: true });
}
