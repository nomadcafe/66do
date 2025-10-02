'use client';

import { createContext, useContext, useState } from 'react';

interface AuthContextType {
  user: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  session: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [session, setSession] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading, setLoading] = useState(false);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    // Mock authentication for development
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setTimeout(() => {
      setUser({ email, id: '1' });
      setSession({ user: { email, id: '1' } });
      setLoading(false);
    }, 1000);
    return { error: null };
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    // Mock registration for development
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setTimeout(() => {
      setUser({ email, id: '1' });
      setSession({ user: { email, id: '1' } });
      setLoading(false);
    }, 1000);
    return { error: null };
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}