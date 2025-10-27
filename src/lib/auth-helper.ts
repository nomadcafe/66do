import { NextRequest } from 'next/server';
import { supabase } from '../../src/lib/supabase';

export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
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
      return user.id;
    }

    // 方法2: 从cookies获取session
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      // 解析cookies
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      // 查找Supabase session cookie
      const sessionCookie = cookies['sb-svwviyvkpivbdylilbfu-auth-token'] || 
                           cookies['supabase-auth-token'] ||
                           Object.keys(cookies).find(key => key.includes('supabase') && key.includes('auth'));
      
      if (sessionCookie) {
        try {
          const sessionData = JSON.parse(decodeURIComponent(sessionCookie));
          if (sessionData?.user?.id) {
            return sessionData.user.id;
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
        return body.userId;
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
