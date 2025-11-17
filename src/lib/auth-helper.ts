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

      // Supabase cookie命名格式: sb-<project-ref>-auth-token
      // 搜索所有可能的cookie名称
      const possibleKeys = Object.keys(cookies).filter(key =>
        key.includes('auth-token') || 
        key.includes('supabase-auth') ||
        key.startsWith('sb-') && key.includes('auth')
      );

      console.log('Found possible auth cookies:', possibleKeys);

      for (const key of possibleKeys) {
        const rawValue = cookies[key];
        if (!rawValue) continue;

        try {
          const decoded = decodeURIComponent(rawValue);
          let sessionData;
          
          // 尝试解析JSON
          try {
            sessionData = JSON.parse(decoded);
          } catch {
            // 如果不是JSON，可能是直接的token字符串
            if (decoded.length > 50) {
              // 可能是JWT token
              const { data: { user }, error } = await supabase.auth.getUser(decoded);
              if (user && !error) {
                console.log('Found valid token in cookie:', key);
                return {
                  userId: user.id,
                  accessToken: decoded,
                };
              }
            }
            continue;
          }

          // 处理数组格式 [access_token, refresh_token]
          if (Array.isArray(sessionData)) {
            const [accessToken] = sessionData;
            if (typeof accessToken === 'string' && accessToken.length > 0) {
              const { data: { user }, error } = await supabase.auth.getUser(accessToken);
              if (user && !error) {
                console.log('Found valid session in cookie array:', key);
                return {
                  userId: user.id,
                  accessToken,
                };
              }
            }
          } 
          // 处理对象格式 { user: {...}, access_token: "...", refresh_token: "..." }
          else if (sessionData?.user?.id) {
            const accessToken = sessionData.access_token || sessionData.accessToken;
            if (accessToken) {
              const { data: { user }, error } = await supabase.auth.getUser(accessToken);
              if (user && !error) {
                console.log('Found valid session in cookie object:', key);
                return {
                  userId: user.id,
                  accessToken,
                };
              }
            }
            // 如果没有access_token，但user.id存在，尝试使用user.id
            // 但这需要从Supabase获取session，暂时跳过
          }
        } catch (e) {
          console.error('Error parsing session cookie:', key, e);
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
