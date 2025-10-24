'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { validateStoredSession, cleanupExpiredSessions } from '../lib/auth';

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
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateAuthState: (user: User, session: Session) => void;
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

  const signInWithMagicLink = async (email: string) => {
    setLoading(true);
    try {
      // 发送Magic Link邮件
      const response = await fetch('/api/send-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '发送登录链接失败');
      }

      setLoading(false);
      return { error: null };
    } catch (error: unknown) {
      setLoading(false);
      return { error: error instanceof Error ? error : new Error('发送登录链接失败') };
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

  const updateAuthState = (user: User, session: Session) => {
    setUser(user);
    setSession(session);
  };

  const value = {
    user,
    session,
    loading,
    signInWithMagicLink,
    signOut,
    updateAuthState,
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