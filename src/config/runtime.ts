const readEnv = (value: string | undefined): string => value?.trim() ?? '';

const readOptionalEnv = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const runtimeConfig = {
  supabaseUrl: readEnv(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY),
  aiProxyUrl: readOptionalEnv(import.meta.env.VITE_AI_PROXY_URL),
  aiApiKeys: {
    google: readEnv(import.meta.env.VITE_GOOGLE_API_KEY),
    anthropic: readEnv(import.meta.env.VITE_ANTHROPIC_API_KEY),
    openai: readEnv(import.meta.env.VITE_OPENAI_API_KEY),
  },
} as const;

export const missingSupabaseEnvVars = [
  runtimeConfig.supabaseUrl ? null : 'VITE_SUPABASE_URL',
  runtimeConfig.supabaseAnonKey ? null : 'VITE_SUPABASE_ANON_KEY',
].filter((value): value is string => Boolean(value));

export const isSupabaseConfigured = missingSupabaseEnvVars.length === 0;

export const supabaseConfigError = isSupabaseConfigured
  ? null
  : `Missing required Supabase environment variables: ${missingSupabaseEnvVars.join(', ')}. Set them in .env.local for local development or in your deployment provider before starting Co-Cut.`;
