import { createClient } from '@supabase/supabase-js';
import { config } from './index.js';

export const isSupabaseConfigured = Boolean(
  config.supabase.url &&
  config.supabase.anonKey &&
  config.supabase.url !== 'your_supabase_project_url'
);

// Regular client (respects RLS)
export const supabase = isSupabaseConfigured
  ? createClient(config.supabase.url, config.supabase.anonKey)
  : null;

// Admin client (bypasses RLS using Service Role Key for background processing)
export const supabaseAdmin = (isSupabaseConfigured && config.supabase.serviceRoleKey)
  ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

