import { NextRequest } from 'next/server';

const productionOrigins = [
  'https://www.domain.financial',
  'https://domain.financial',
];

const developmentOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3078',
];

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? productionOrigins
  : [...productionOrigins, ...developmentOrigins];

// 没有 GET：用这套头的路由（domains / transactions / installment-receipts /
// send-magic-link）全是写接口。读路径由浏览器直连 Supabase 走 RLS，唯一剩下
// 的 GET 是同源的 /api/auth/events，它不经过 CORS。
//
// Auth is Bearer-only via the Authorization header (see auth-helper.ts);
// cookies are never used for auth. We intentionally do NOT send
// Access-Control-Allow-Credentials -- leaving it off means a future addition
// of cookie-based auth would have to be done deliberately and paired with
// CSRF protection instead of silently inheriting CORS credentials.
export function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin');
  const isAllowedOrigin = allowedOrigins.includes(origin || '');

  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin! : 'https://www.domain.financial',
    'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Refresh-Token',
    // 响应内容随 Origin 变化，必须让任何中间缓存按 Origin 分片存储。
    // 少了它，一个共享缓存可能把给 A 站点的 Allow-Origin 回给 B 站点。
    'Vary': 'Origin',
  };
}

/**
 * catch 块里用的 CORS 头。传 request 时与正常响应走同一套 origin 判定——
 * 否则本地开发时 500 响应会被浏览器 CORS 拦掉，恰恰是最需要看到报错的时候。
 * 无法拿到 request 的极端情况才退回生产域名。
 */
export function getCorsHeadersForError(request?: NextRequest) {
  if (request) return getCorsHeaders(request);

  return {
    'Access-Control-Allow-Origin': 'https://www.domain.financial',
    'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Refresh-Token',
    'Vary': 'Origin',
  };
}

