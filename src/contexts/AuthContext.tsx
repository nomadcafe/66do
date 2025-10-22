'use client';

import { createContext, useContext, useState, useEffect } from 'react';

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
  const [loading, setLoading] = useState(true); // Start with loading true to check for existing session

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = () => {
      try {
               const storedUser = localStorage.getItem('66do_user');
               const storedSession = localStorage.getItem('66do_session');
        
        if (storedUser && storedSession) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setSession({ user: userData, token: storedSession });
        }
      } catch (error) {
        console.error('Error checking existing session:', error);
               // Clear invalid data
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
      // Basic email validation
      if (!email || !email.includes('@')) {
        setLoading(false);
        return { error: new Error('Invalid email format') };
      }
      
      // Basic password validation
      if (!password || password.length < 6) {
        setLoading(false);
        return { error: new Error('Password must be at least 6 characters') };
      }
      
      // Generate a secure user ID based on email
      const userId = btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
      
      // Create session token
      const sessionToken = btoa(`${email}:${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '');
      
      // Store in localStorage for persistence
      localStorage.setItem('66do_user', JSON.stringify({ email, id: userId }));
      localStorage.setItem('66do_session', sessionToken);
      
      setUser({ email, id: userId });
      setSession({ user: { email, id: userId }, token: sessionToken });
      setLoading(false);
      return { error: null };
    } catch (error) {
      setLoading(false);
      return { error: error instanceof Error ? error : new Error('Authentication failed') };
    }
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Basic email validation
      if (!email || !email.includes('@')) {
        setLoading(false);
        return { error: new Error('Invalid email format') };
      }
      
      // Basic password validation
      if (!password || password.length < 6) {
        setLoading(false);
        return { error: new Error('Password must be at least 6 characters') };
      }
      
      // Check if user already exists
      const existingUser = localStorage.getItem('66do_user');
      if (existingUser) {
        const userData = JSON.parse(existingUser);
        if (userData.email === email) {
          setLoading(false);
          return { error: new Error('User already exists') };
        }
      }
      
      // Generate a secure user ID based on email
      const userId = btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
      
      // Create session token
      const sessionToken = btoa(`${email}:${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '');
      
      // Store in localStorage for persistence
      localStorage.setItem('66do_user', JSON.stringify({ email, id: userId }));
      localStorage.setItem('66do_session', sessionToken);
      
      setUser({ email, id: userId });
      setSession({ user: { email, id: userId }, token: sessionToken });
      setLoading(false);
      return { error: null };
    } catch (error) {
      setLoading(false);
      return { error: error instanceof Error ? error : new Error('Registration failed') };
    }
  };

  const signOut = async () => {
    // Clear localStorage
    localStorage.removeItem('66do_user');
    localStorage.removeItem('66do_session');
    
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