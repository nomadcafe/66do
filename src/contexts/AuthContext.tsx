'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { validateUser, createUser, createSession, validateStoredSession, cleanupExpiredSessions } from '../lib/auth';

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

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  completeRegistration: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    const checkExistingSession = () => {
      try {
        // 清理过期会话
        cleanupExpiredSessions();
        
        const storedUser = localStorage.getItem('66do_user');
        const storedSession = localStorage.getItem('66do_session');
        
        console.log('Checking existing session:', { storedUser: !!storedUser, storedSession: !!storedSession });
        
        if (storedUser && storedSession) {
          const userData = JSON.parse(storedUser);
          const sessionData = JSON.parse(storedSession);
          
          console.log('Session data:', { 
            userEmail: userData.email, 
            sessionExpires: sessionData.expires_at,
            isValid: validateStoredSession()
          });
          
          // 验证会话
          if (validateStoredSession()) {
            console.log('Session is valid, setting user');
            setUser(userData);
            setSession(sessionData);
          } else {
            console.log('Session is invalid, cleaning up');
            // 会话无效，清理数据
            localStorage.removeItem('66do_user');
            localStorage.removeItem('66do_session');
          }
        } else {
          console.log('No stored session found');
        }
      } catch (error) {
        console.error('Error checking existing session:', error);
        localStorage.removeItem('66do_user');
        localStorage.removeItem('66do_session');
      } finally {
        setLoading(false);
      }
    };
    
    checkExistingSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      // 验证用户凭据
      const user = await validateUser(email, password);
      
      if (!user) {
        throw new Error('邮箱或密码错误');
      }

      // 创建会话
      const session = createSession(user);
      
      // 存储到localStorage
      localStorage.setItem('66do_user', JSON.stringify(user));
      localStorage.setItem('66do_session', JSON.stringify(session));
      
      setUser(user);
      setSession(session);
      setLoading(false);
      
      return { error: null };
    } catch (error: unknown) {
      setLoading(false);
      return { error: error instanceof Error ? error : new Error('登录失败') };
    }
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    try {
      // 使用真实的用户创建功能
      const { user: newUser, error: createError, requiresVerification } = await createUser(email, password);
      
      if (createError || !newUser) {
        throw new Error(createError || '用户创建失败');
      }

      setLoading(false);
      
      // 如果需要邮箱验证，不创建会话，直接跳转验证页面
      if (requiresVerification) {
        return { error: null, requiresVerification: true };
      }

      // 只有在邮箱验证通过后才创建会话
      const session = createSession(newUser);
      
      // 存储到localStorage
      localStorage.setItem('66do_user', JSON.stringify(newUser));
      localStorage.setItem('66do_session', JSON.stringify(session));
      
      setUser(newUser);
      setSession(session);
      
      return { error: null };
    } catch (error: unknown) {
      setLoading(false);
      return { error: error instanceof Error ? error : new Error('注册失败') };
    }
  };

  const completeRegistration = async (email: string, password: string) => {
    setLoading(true);
    try {
      // 完成注册（实际应用中应该验证邮箱）
      const user = await validateUser(email, password);
      
      if (!user) {
        throw new Error('用户验证失败');
      }

      const session = createSession(user);
      
      localStorage.setItem('66do_user', JSON.stringify(user));
      localStorage.setItem('66do_session', JSON.stringify(session));
      
      setUser(user);
      setSession(session);
      setLoading(false);
      
      return { error: null };
    } catch (error: unknown) {
      setLoading(false);
      return { error: error instanceof Error ? error : new Error('注册完成失败') };
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      // 清理localStorage
      localStorage.removeItem('66do_user');
      localStorage.removeItem('66do_session');
      
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    completeRegistration,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}