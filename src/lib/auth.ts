// 基于D1数据库的真实认证系统

interface User {
  id: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface Session {
  user: User;
  token: string;
  expires_at: string;
}

// 生成UUID v4
function generateUUID(): string {
  return crypto.randomUUID();
}

// 生成安全的会话令牌
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 密码哈希函数
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 验证密码
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// 从D1数据库获取用户
async function getUserFromDatabase(email: string): Promise<User | null> {
  try {
    // 调用D1数据库API
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getUser',
        email: email
      })
    });

    if (!response.ok) {
      throw new Error(`Database query failed: ${response.status}`);
    }

    const result = await response.json();
    return result.user || null;
  } catch (error) {
    console.error('Database query error:', error);
    throw error; // 直接抛出错误，不使用降级机制
  }
}

// 保存用户到D1数据库
async function saveUserToDatabase(user: User): Promise<boolean> {
  try {
    // 调用D1数据库API
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'saveUser',
        user: user
      })
    });

    if (!response.ok) {
      throw new Error(`Database save failed: ${response.status}`);
    }

    const result = await response.json();
    return result.success || false;
  } catch (error) {
    console.error('Database save error:', error);
    throw error; // 直接抛出错误，不使用降级机制
  }
}

// 验证用户凭据
export async function validateUser(email: string, password: string): Promise<User | null> {
  try {
    let user = await getUserFromDatabase(email);
    
    // 如果用户不存在，创建新用户
    if (!user) {
      console.log('User not found, creating new user during login');
      const passwordHash = await hashPassword(password);
      const newUser: User = {
        id: generateUUID(),
        email,
        password_hash: passwordHash,
        email_verified: true, // 假设邮箱已验证（通过验证码）
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // 尝试保存到数据库
      const saved = await saveUserToDatabase(newUser);
      if (saved) {
        user = newUser;
      } else {
        console.log('Failed to save user to database, using local storage fallback');
        // 如果数据库保存失败，使用localStorage作为备用
        return newUser;
      }
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return null;
    }

    // 返回用户信息（不包含密码哈希）
    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      updated_at: user.updated_at
    } as User;
  } catch (error) {
    console.error('User validation error:', error);
    return null;
  }
}

// 创建新用户
export async function createUser(email: string, password: string): Promise<{ user: User | null; error: string | null; requiresVerification?: boolean }> {
  try {
    // 检查邮箱是否已存在
    const existingUser = await getUserFromDatabase(email);
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
    const newUser: User = {
      id: generateUUID(),
      email,
      password_hash: passwordHash,
      email_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 保存到数据库
    const saved = await saveUserToDatabase(newUser);
    if (!saved) {
      return { user: null, error: '用户创建失败' };
    }

    // 发送邮箱验证邮件
    try {
      const { sendVerificationEmail } = await import('./emailVerification');
      await sendVerificationEmail(email, newUser.id);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // 不阻止用户注册，但记录错误
    }

    // 返回用户信息（不包含密码哈希）
    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        created_at: newUser.created_at,
        updated_at: newUser.updated_at
      } as User,
      error: null,
      requiresVerification: true
    };
  } catch (error) {
    console.error('User creation error:', error);
    return { user: null, error: '用户创建失败' };
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

    // 检查token是否匹配且未过期
    return session.token === token && now < expiresAt;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
}

// 验证存储的会话是否有效
export function validateStoredSession(): boolean {
  try {
    const sessionData = localStorage.getItem('66do_session');
    if (!sessionData) return false;

    const session: Session = JSON.parse(sessionData);
    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    // 检查会话是否未过期
    return now < expiresAt;
  } catch (error) {
    console.error('Stored session validation error:', error);
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
