export interface SupabaseEnvironment {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

/** Public client configuration only; a server secret must never become an APK credential. */
export function supabaseConfig(env: SupabaseEnvironment): { url: string; key: string } | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key || key.startsWith('sb_secret_')) return null;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return null;
    const payload = key.split('.')[1];
    if (payload) {
      try {
        if (JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role') return null;
      } catch { /* The server validates the public key. */ }
    }
    return { url: parsed.href.replace(/\/$/, ''), key };
  } catch {
    return null;
  }
}
