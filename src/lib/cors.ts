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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Refresh-Token',
  };
}

export function getCorsHeadersForError() {
  return {
    'Access-Control-Allow-Origin': 'https://www.domain.financial',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Refresh-Token',
  };
}

/** 用于数据 API 的 no-cache 头，避免 304 导致返回旧数据 */
export const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache'
} as const;
