const get = (name: string) => (import.meta.env[name] as string | undefined)?.trim() || '';
export const env = {
  supabaseUrl: get('VITE_SUPABASE_URL'),
  supabaseKey: get('VITE_SUPABASE_PUBLISHABLE_KEY'),
  repositoryName: get('VITE_GITHUB_REPOSITORY_NAME'),
  publicAppUrl: get('VITE_PUBLIC_APP_URL') || window.location.origin + window.location.pathname
};
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseKey);
