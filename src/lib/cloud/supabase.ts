
import { createClient } from '@supabase/supabase-js';

// Fix: Cast import.meta to any to resolve Property 'env' does not exist on type 'ImportMeta' errors in this environment
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing environment variables. Cloud features may be disabled.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
