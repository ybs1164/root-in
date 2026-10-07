import type { SupabaseClient } from '@supabase/supabase-js';

// Like the Kakao key: without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY the
// app runs exactly as before (everything on this device), so `npm run dev`
// and the tests need no backend. The anon key is meant to be public — row
// level security (supabase/migrations) is what keeps data private; the
// service_role key must never be put here.

export function supabaseConfigured(): boolean {
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

let client: Promise<SupabaseClient | null> | null = null;

/** The shared client, or null when not configured or the library failed to load. */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured()) return Promise.resolve(null);
  // Imported on demand so a key-less build doesn't pay for the library up front.
  client ??= import('@supabase/supabase-js')
    .then(({ createClient }) =>
      createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string, {
        auth: {
          // PKCE returns with ?code= in the query; the implicit flow would put
          // tokens in the #hash, which share links (#share=, #pins=) already use.
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      }),
    )
    .catch(() => null);
  return client;
}
