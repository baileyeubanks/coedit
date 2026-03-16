import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  isSupabaseConfigured,
  missingSupabaseEnvVars,
  runtimeConfig,
  supabaseConfigError,
} from '../config/runtime';

let supabaseClient: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  supabaseClient = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      persistSession: true,
    },
  });
}

export { isSupabaseConfigured, missingSupabaseEnvVars, supabaseConfigError };

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  }

  return supabaseClient;
}
