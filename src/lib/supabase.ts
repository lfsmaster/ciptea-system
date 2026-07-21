import { createClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from './env';

export const supabase = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export function requireSupabase() {
  if (!supabase) throw new Error('Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.');
  return supabase;
}
