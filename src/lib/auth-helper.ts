import { NextRequest } from 'next/server';
import { supabase } from '../../src/lib/supabase';

export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  return getAuthInfoFromRequest(request).then(info => info?.userId || null);
}

export async function getAuthInfoFromRequest(request: NextRequest): Promise<{ userId: string; accessToken?: string } | null> {
  try {
    // 方法1: 从Authorization header获取token
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        console.error('Error getting user from token:', error);
        return null;
      }
      return { userId: user.id, accessToken: token };
    }

    // 方法2: 从cookies获取session
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      // 解析cookies
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, ...rest] = cookie.trim().split('=');
        acc[key] = rest.join('=');
        return acc;
      }, {} as Record<string, string>);

      // Supabase 默认cookie命名包含 auth-token
      const possibleKeys = Object.keys(cookies).filter(key =>
        key.includes('auth-token') || key.includes('supabase-auth')
      );

      for (const key of possibleKeys) {
        const rawValue = cookies[key];
        if (!rawValue) continue;

        try {
          const decoded = decodeURIComponent(rawValue);
          const sessionData = JSON.parse(decoded);

          if (Array.isArray(sessionData)) {
            const [accessToken] = sessionData;
            if (typeof accessToken === 'string' && accessToken.length > 0) {
              const { data: { user }, error } = await supabase.auth.getUser(accessToken);
              if (user && !error) {
                return {
                  userId: user.id,
                  accessToken,
                };
              }
            }
          } else if (sessionData?.user?.id) {
            return {
              userId: sessionData.user.id,
              accessToken: sessionData.access_token,
            };
          }
        } catch (e) {
          console.error('Error parsing session cookie:', e);
        }
      }
    }

    // 方法3: 尝试从request body获取userId（如果前端传递了）
    try {
      const body = await request.clone().json();
      if (body.userId) {
        return { userId: body.userId };
      }
    } catch (e) {
      // 忽略JSON解析错误
    }

    console.error('No valid authentication found in request');
    return null;
  } catch (error) {
    console.error('Error in getUserIdFromRequest:', error);
    return null;
  }
}
