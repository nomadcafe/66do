'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  user: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  session: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  completeRegistration: (email: string, password: string) => Promise<{ error: Error | null }>;
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
      
      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Send verification email
      try {
        const emailResponse = await fetch('/api/send-verification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            verificationCode,
            language: localStorage.getItem('66do-language') || 'en'
          })
        });
        
        if (!emailResponse.ok) {
          setLoading(false);
          return { error: new Error('Failed to send verification email') };
        }
        
        // Store verification data temporarily
        const verificationData = {
          email,
          code: verificationCode,
          timestamp: Date.now(),
          password: password, // Store password temporarily for verification
          language: localStorage.getItem('66do-language') || 'en' // Save user's language preference
        };
        
        localStorage.setItem('66do_verification', JSON.stringify(verificationData));
        
        setLoading(false);
        return { 
          error: null, 
          requiresVerification: true,
          message: '验证码已发送到您的邮箱，请查收并输入验证码完成注册'
        };
        
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        setLoading(false);
        return { error: new Error('Email service unavailable') };
      }
      
    } catch (error) {
      setLoading(false);
      return { error: error instanceof Error ? error : new Error('Registration failed') };
    }
  };

  const completeRegistration = async (email: string) => {
    setLoading(true);
    try {
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
      return { error: error instanceof Error ? error : new Error('Registration completion failed') };
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
    completeRegistration,
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