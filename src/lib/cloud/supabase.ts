
import { createClient } from '@supabase/supabase-js';

// Fix: Now using proper ImportMeta types from vite-env.d.ts, so 'as any' is no longer required
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing environment variables. Cloud features may be disabled.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');