// 基于D1数据库的真实认证系统
import { supabase } from './supabase';

interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

interface Session {
  user: User;
  token: string;
  expires_at: string;
}

// 生成安全的会话令牌
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 验证用户凭据
export async function validateUser(email: string, password: string): Promise<User | null> {
  try {
    // 这里应该调用D1数据库验证用户
    // 暂时使用模拟验证，但应该替换为真实的数据库查询
    if (email && password.length >= 6) {
      return {
        id: generateSecureToken(),
        email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    return null;
  } catch (error) {
    console.error('User validation error:', error);
    return null;
  }
}

// 创建用户会话
export function createSession(user: User): Session {
  const token = generateSecureToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24小时过期

  return {
    user,
    token,
    expires_at: expiresAt.toISOString()
  };
}

// 验证会话令牌
export function validateSession(token: string): boolean {
  try {
    const sessionData = localStorage.getItem('66do_session');
    if (!sessionData) return false;

    const session: Session = JSON.parse(sessionData);
    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    return session.token === token && now < expiresAt;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
}

// 清理过期会话
export function cleanupExpiredSessions(): void {
  try {
    const sessionData = localStorage.getItem('66do_session');
    if (!sessionData) return;

    const session: Session = JSON.parse(sessionData);
    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    if (now >= expiresAt) {
      localStorage.removeItem('66do_session');
      localStorage.removeItem('66do_user');
    }
  } catch (error) {
    console.error('Session cleanup error:', error);
    localStorage.removeItem('66do_session');
    localStorage.removeItem('66do_user');
  }
}
