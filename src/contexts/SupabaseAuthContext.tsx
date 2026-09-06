'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getSiteUrl } from '../lib/siteUrl';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: (redirectAfter?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

// 注意：这里刻意**没有** signInWithMagicLink。魔法链接必须走
// POST /api/send-magic-link —— 那条路由上挂着按 IP（5 次 /15 分钟）和按邮箱
// （3 次 /1 小时）的限流，是防邮箱枚举和 Supabase 配额被烧的唯一一道闸。
// 在浏览器里直接调 supabase.auth.signInWithOtp() 会整个绕过它。
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始化认证状态
  useEffect(() => {
    let mounted = true;

    // 获取当前会话
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error.message);
        } else if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async (redirectAfter?: string): Promise<{ error: AuthError | null }> => {
    try {
      // Same rationale as magic-link: canonicalise to the env host so a
      // misconfigured wildcard in Supabase Auth allow-list can't route the
      // OAuth callback to an attacker subdomain.
      const callbackUrl = new URL('/auth/callback', getSiteUrl());
      if (redirectAfter) callbackUrl.searchParams.set('redirect', redirectAfter);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl.toString() }
      });
      if (error) return { error };
      if (data?.url) window.location.href = data.url;
      return { error: null };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
      }
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('Refresh session error:', error.message);
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
    } catch (error) {
      console.error('Refresh session error:', error);
    }
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
}
