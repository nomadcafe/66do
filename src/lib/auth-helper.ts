import { NextRequest } from 'next/server';
import { supabase } from '../../src/lib/supabase';
import { logger } from './logger';

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
        logger.error('Error getting user from token:', error);
        return null;
      }
      return { userId: user.id, accessToken: token };
    }

    // 方法2: 从cookies获取session
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, ...rest] = cookie.trim().split('=');
        acc[key] = rest.join('=');
        return acc;
      }, {} as Record<string, string>);

      const possibleKeys = Object.keys(cookies).filter(key =>
        key.includes('auth-token') ||
        key.includes('supabase-auth') ||
        (key.startsWith('sb-') && key.includes('auth'))
      );

      logger.debug('Auth: checking cookies (count:', possibleKeys.length, ')');

      for (const key of possibleKeys) {
        const rawValue = cookies[key];
        if (!rawValue) continue;

        try {
          const decoded = decodeURIComponent(rawValue);
          let sessionData;

          try {
            sessionData = JSON.parse(decoded);
          } catch {
            if (decoded.length > 50) {
              const { data: { user }, error } = await supabase.auth.getUser(decoded);
              if (user && !error) {
                logger.debug('Auth: valid session from cookie');
                return { userId: user.id, accessToken: decoded };
              }
            }
            continue;
          }

          if (Array.isArray(sessionData)) {
            const [accessToken] = sessionData;
            if (typeof accessToken === 'string' && accessToken.length > 0) {
              const { data: { user }, error } = await supabase.auth.getUser(accessToken);
              if (user && !error) {
                logger.debug('Auth: valid session from cookie array');
                return { userId: user.id, accessToken };
              }
            }
          } else if (sessionData?.user?.id) {
            const accessToken = sessionData.access_token || sessionData.accessToken;
            if (accessToken) {
              const { data: { user }, error } = await supabase.auth.getUser(accessToken);
              if (user && !error) {
                logger.debug('Auth: valid session from cookie object');
                return { userId: user.id, accessToken };
              }
            }
          }
        } catch (e) {
          logger.error('Error parsing session cookie', e);
        }
      }
    }

    logger.debug('No valid authentication found in request');
    return null;
  } catch (error) {
    logger.error('Error in getAuthInfoFromRequest:', error);
    return null;
  }
}
