/**
 * POST /api/auth/notify-sensitive
 * Body: { event: 'data_export' | 'email_change' | 'account_delete' | 'oauth_unbind' }
 *
 * Fired by the client when it triggers a sensitive operation that
 * already lives client-side (data_export today, future email_change /
 * account_delete / oauth_unbind once those flows exist). Records a
 * row in auth_events for review in Recent Activity.
 *
 * Same fail-soft contract as /notify-signin: errors are logged, never
 * surfaced. A failed audit write must not block the user's data export.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recordSensitiveOp, type SensitiveOpEvent } from '../../../../src/lib/securityEvents';
import { logger } from '../../../../src/lib/logger';
import { checkUserAuditRateLimit } from '../../../../src/lib/rateLimit';

export const runtime = 'nodejs';

const VALID_EVENTS: readonly SensitiveOpEvent[] = [
  'data_export',
  'email_change',
  'account_delete',
  'oauth_unbind',
];

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
  if (error || !data?.user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Silently drop on rate-limit hit (see notify-signin for rationale).
  const rl = await checkUserAuditRateLimit(data.user.id);
  if (rl.limited && rl.reason === 'rate') {
    return NextResponse.json({ ok: true });
  }

  await recordSensitiveOp({ id: data.user.id }, event, request);
  return NextResponse.json({ ok: true });
}
