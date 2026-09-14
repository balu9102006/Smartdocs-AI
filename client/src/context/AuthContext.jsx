import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const AuthContext = createContext(null);

const LOCAL_USER_KEY = 'smartdocs_local_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      // Fetch initial Supabase session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });

      // Listen for auth state changes
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });

      return () => subscription.unsubscribe();
    } else {
      // Local fallback mode
      const savedUser = localStorage.getItem(LOCAL_USER_KEY);
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          localStorage.removeItem(LOCAL_USER_KEY);
        }
      } else {
        // Default guest user
        const defaultUser = {
          id: 'user-default-1',
          name: 'Alex Developer',
          email: 'alex.developer@smartdocs.ai'
        };
        setUser(defaultUser);
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(defaultUser));
      }
      setLoading(false);
    }
  }, []);

  // Sign in with Email & Password
  const signIn = async (email, password) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return data;
    }

    // Fallback sign in
    const dummyUser = {
      id: 'user-' + Date.now(),
      name: email.split('@')[0],
      email: email
    };
    setUser(dummyUser);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(dummyUser));
    return { user: dummyUser };
  };

  // Sign up with Email & Password
  const signUp = async (email, password, name) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      });
      if (error) throw error;
      return data;
    }

    // Fallback sign up
    const dummyUser = {
      id: 'user-' + Date.now(),
      name: name || email.split('@')[0],
      email: email
    };
    setUser(dummyUser);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(dummyUser));
    return { user: dummyUser };
  };

  // Sign out
  const signOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    localStorage.removeItem(LOCAL_USER_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        isCloudAuth: isSupabaseConfigured
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

