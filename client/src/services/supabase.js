import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Reject both placeholder styles seen in .env.example ("your_..." and
// "https://your-project.supabase.co") — a copy-pasted example must never
// be mistaken for real config (it would make getDocuments() etc. treat a
// signed-in-looking session as real and surface backend errors instead of
// the intended zero-setup offline sandbox).
const looksLikePlaceholder = (value) => !value || /your[-_]/i.test(value);

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !looksLikePlaceholder(supabaseUrl) &&
  !looksLikePlaceholder(supabaseAnonKey)
);

// If credentials are present, initialize real client; otherwise create safe dummy client
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

