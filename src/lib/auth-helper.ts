import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

// Per-call, non-persisting Supabase client. The browser-side singleton in
// src/lib/supabase.ts keeps a mutable session in memory; reusing it on the
// server would let supabase.auth.refreshSession() from one request leak the
// refreshed session into a concurrent request.
function buildServerAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function getAuthInfoFromRequest(request: NextRequest): Promise<{ userId: string; accessToken?: string } | null> {
  try {
    // Bearer-only: the client stores the session in localStorage and attaches
    // `Authorization: Bearer <token>` on every request. Cookie-based auth is
    // intentionally not accepted here -- adding it later requires CSRF
    // protection, which does not exist yet.
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.debug('No valid authentication found in request');
      return null;
    }

    const client = buildServerAuthClient();

    const token = authHeader.substring(7);
    const { data: { user }, error } = await client.auth.getUser(token);
    if (!error && user) {
      return { userId: user.id, accessToken: token };
    }

    const refreshToken =
      request.headers.get('x-refresh-token') || request.headers.get('X-Refresh-Token');
    if (refreshToken) {
      const { data: refreshData, error: refError } = await client.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (!refError && refreshData.session?.user && refreshData.session.access_token) {
        return {
          userId: refreshData.session.user.id,
          accessToken: refreshData.session.access_token,
        };
      }
    }

    // access token 过期 / 失效、且没有可用 refresh token —— 这是完全正常的
    // 路径（客户端随后会去刷新或重新登录），不是服务端故障。logger.error 在
    // prod 也输出（设计如此），用它会被日常过期刷屏，真正的故障反而被淹没。
    // 只有非 401/403 的失败（Supabase 挂了、网络错误）才算异常。
    const status = (error as { status?: number } | null)?.status;
    if (status === 401 || status === 403) {
      logger.debug('Auth rejected: access token invalid or expired', { status });
    } else {
      logger.error('Error getting user from token:', error);
    }
    return null;
  } catch (error) {
    logger.error('Error in getAuthInfoFromRequest:', error);
    return null;
  }
}
