// D1数据库真实认证系统
// 集成Cloudflare D1数据库进行用户认证

interface D1User {
  id: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface D1Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

// D1数据库API调用
class D1AuthAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_D1_API_URL || '';
    this.apiKey = process.env.D1_API_KEY || '';
  }

  // 调用D1数据库API
  private async callD1API(endpoint: string, method: string = 'GET', data?: Record<string, unknown>) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        throw new Error(`D1 API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('D1 API call failed:', error);
      throw error;
    }
  }

  // 获取用户
  async getUser(email: string): Promise<D1User | null> {
    try {
      const result = await this.callD1API(`/users?email=${encodeURIComponent(email)}`);
      return result.data?.[0] || null;
    } catch (error) {
      console.error('Get user failed:', error);
      return null;
    }
  }

  // 创建用户
  async createUser(userData: Omit<D1User, 'id' | 'created_at' | 'updated_at'>): Promise<D1User | null> {
    try {
      const result = await this.callD1API('/users', 'POST', userData);
      return result.data || null;
    } catch (error) {
      console.error('Create user failed:', error);
      return null;
    }
  }

  // 更新用户
  async updateUser(id: string, userData: Partial<D1User>): Promise<boolean> {
    try {
      await this.callD1API(`/users/${id}`, 'PUT', userData);
      return true;
    } catch (error) {
      console.error('Update user failed:', error);
      return false;
    }
  }

  // 创建会话
  async createSession(sessionData: Omit<D1Session, 'id' | 'created_at'>): Promise<D1Session | null> {
    try {
      const result = await this.callD1API('/sessions', 'POST', sessionData);
      return result.data || null;
    } catch (error) {
      console.error('Create session failed:', error);
      return null;
    }
  }

  // 验证会话
  async validateSession(token: string): Promise<D1Session | null> {
    try {
      const result = await this.callD1API(`/sessions/validate?token=${encodeURIComponent(token)}`);
      return result.data || null;
    } catch (error) {
      console.error('Validate session failed:', error);
      return null;
    }
  }

  // 删除会话
  async deleteSession(token: string): Promise<boolean> {
    try {
      await this.callD1API(`/sessions/${token}`, 'DELETE');
      return true;
    } catch (error) {
      console.error('Delete session failed:', error);
      return false;
    }
  }

  // 清理过期会话
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await this.callD1API('/sessions/cleanup', 'POST');
      return result.cleaned || 0;
    } catch (error) {
      console.error('Cleanup sessions failed:', error);
      return 0;
    }
  }
}

// 导出D1认证API实例
export const d1AuthAPI = new D1AuthAPI();

// 密码哈希函数
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 验证密码
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// 生成安全令牌
export function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 验证用户凭据（D1版本）
export async function validateUserD1(email: string, password: string): Promise<D1User | null> {
  try {
    const user = await d1AuthAPI.getUser(email);
    if (!user) {
      return null;
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('D1 user validation error:', error);
    return null;
  }
}

// 创建用户（D1版本）
export async function createUserD1(email: string, password: string): Promise<{ user: D1User | null; error: string | null }> {
  try {
    // 检查邮箱是否已存在
    const existingUser = await d1AuthAPI.getUser(email);
    if (existingUser) {
      return { user: null, error: '邮箱已被注册' };
    }

    // 验证邮箱格式
    if (!email || !email.includes('@')) {
      return { user: null, error: '请输入有效的邮箱地址' };
    }

    // 验证密码强度
    if (!password || password.length < 6) {
      return { user: null, error: '密码至少需要6个字符' };
    }

    // 创建新用户
    const passwordHash = await hashPassword(password);
    const newUser = await d1AuthAPI.createUser({
      email,
      password_hash: passwordHash,
      email_verified: false,
    });

    if (!newUser) {
      return { user: null, error: '用户创建失败' };
    }

    return { user: newUser, error: null };
  } catch (error) {
    console.error('D1 user creation error:', error);
    return { user: null, error: '用户创建失败' };
  }
}
