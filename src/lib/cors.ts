import { NextRequest } from 'next/server';

// 允许的域名列表
const allowedOrigins = [
  'https://www.domain.financial',
  'https://domain.financial',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3078'
];

export function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin');
  const isAllowedOrigin = allowedOrigins.includes(origin || '');
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin! : 'https://www.domain.financial',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };
}

export function getCorsHeadersForError() {
  return {
    'Access-Control-Allow-Origin': 'https://www.domain.financial',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };
}
