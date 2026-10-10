import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const AuthContext = createContext(null);

const LOCAL_USER_KEY = 'smartdocs_local_user';
const LOCAL_AUTH_ENABLED = import.meta.env.VITE_ALLOW_LOCAL_AUTH === 'true';

const normalizeAuthError = (err) => {
  const message = err?.message || '';

  if (/Failed to fetch|fetch failed|NetworkError/i.test(message)) {
    return new Error('Authentication service is unavailable. Check your Supabase URL, network access, and whether email/password sign-in is enabled in the project settings.');
  }

  if (/invalid login credentials|Invalid login credentials|Email not confirmed|User not found|invalid_credentials/i.test(message)) {
    return new Error('Incorrect email or password. Please verify your credentials and try again.');
  }

  if (/duplicate|already registered|already exists|User already registered/i.test(message)) {
    return new Error('An account with this email already exists. Please log in instead.');
  }

  if (/auth.*disabled|not enabled|Provider.*disabled|email.*not.*enabled/i.test(message)) {
    return new Error('Email authentication is not enabled for this Supabase project. Enable Email/Password auth in your Supabase dashboard.');
  }

  if (!message) {
    return new Error('Authentication failed. Please try again.');
  }

  return err;
};

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
      if (!LOCAL_AUTH_ENABLED) {
        setUser(null);
        localStorage.removeItem(LOCAL_USER_KEY);
        setLoading(false);
        return;
      }

      // Optional local fallback mode only when explicitly enabled.
      const savedUser = localStorage.getItem(LOCAL_USER_KEY);
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          localStorage.removeItem(LOCAL_USER_KEY);
        }
      } else {
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
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        return data;
      } catch (err) {
        throw normalizeAuthError(err);
      }
    }

    if (!LOCAL_AUTH_ENABLED) {
      const message = 'Authentication is not configured. Set your Supabase environment variables or enable VITE_ALLOW_LOCAL_AUTH for the offline sandbox.';
      throw new Error(message);
    }

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
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name }
          }
        });
        if (error) throw error;
        return data;
      } catch (err) {
        throw normalizeAuthError(err);
      }
    }

    if (!LOCAL_AUTH_ENABLED) {
      const message = 'Authentication is not configured. Set your Supabase environment variables or enable VITE_ALLOW_LOCAL_AUTH for the offline sandbox.';
      throw new Error(message);
    }

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

