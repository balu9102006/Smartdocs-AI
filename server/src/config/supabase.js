import { createClient } from '@supabase/supabase-js';
import { config } from './index.js';

// A placeholder value copy-pasted from .env.example (or left unset) must
// never be mistaken for a real configuration — that's exactly the gap that
// let auth silently fall back to trusting a client-supplied user id header.
const looksLikePlaceholder = (value) => !value || /your[-_]/i.test(value);

export const isSupabaseConfigured = Boolean(
  config.supabase.url &&
  config.supabase.anonKey &&
  config.supabase.serviceRoleKey &&
  config.supabase.url.startsWith('https://') &&
  !looksLikePlaceholder(config.supabase.url) &&
  !looksLikePlaceholder(config.supabase.anonKey) &&
  !looksLikePlaceholder(config.supabase.serviceRoleKey)
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

