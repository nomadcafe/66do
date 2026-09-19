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
import { checkUserWriteRateLimit } from '../../../../src/lib/rateLimit';
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

  // 全站唯一一个没有限流的数据端点——其余 domains / transactions /
  // installment-receipts 各自的 handler 都挂了。这里是只读、RLS 内、上限 100
  // 行，泄不出别人的东西，但一个拿着自己 token 的客户端可以无节制地打它。
  //
  // 复用 userWrite 那档（60/min/用户）：名字里的 "write" 指的是限流档位不是
  // HTTP 动词，60/min 对一个设置面板里的列表正好；audit 那档不能用，它的约定
  // 是超限后静默返回成功不落库，放在 GET 上就成了"限流时假装没有事件"。
  const rl = await checkUserWriteRateLimit(userId);
  if (rl.limited) {
    return NextResponse.json(
      { ok: false, error: rl.reason === 'rate' ? 'rate_limited' : 'backend_unavailable' },
      { status: rl.reason === 'rate' ? 429 : 503 }
    );
  }

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
