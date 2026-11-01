import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, supabaseConfigured } from '../lib/supabase';

// This phone's push token on the account (supabase/migrations/20261110000000_place_alerts.sql
// push_tokens): saved while someone is signed in, dropped before signing out
// so the next person on the phone doesn't get their pushes. Never rejects.

export type PushPlatform = 'android' | 'ios';

export interface PushTokenService {
  readonly available: boolean;
  /** This phone gets the signed-in person's pushes (it's remembered for `forget`). */
  save(token: string, platform: PushPlatform): Promise<boolean>;
  /** Signing out: this phone stops getting them. Nothing to do when no token was saved. */
  forget(): Promise<void>;
}

/** FCM and APNs tokens are long; anything outside this is not a token. */
export function isPushToken(token: unknown): token is string {
  return typeof token === 'string' && token.length >= 20 && token.length <= 4096 && !/\s/.test(token);
}

export function createPushTokenService(
  getClient: () => Promise<SupabaseClient | null> = getSupabase,
  available = supabaseConfigured(),
): PushTokenService {
  let saved: string | null = null;
  return {
    available,
    async save(token, platform) {
      if (!available || !isPushToken(token)) return false;
      try {
        const client = await getClient();
        if (!client) return false;
        const { data, error } = await client.rpc('save_push_token', { push_token: token, push_platform: platform });
        if (error || data !== true) return false;
        saved = token;
        return true;
      } catch {
        return false;
      }
    },
    async forget() {
      const token = saved;
      if (!token) return;
      saved = null;
      try {
        const client = await getClient();
        if (client) await client.rpc('drop_push_token', { push_token: token });
      } catch {
        // Signed out anyway; the token goes when someone else signs in on this phone.
      }
    },
  };
}

export const pushTokenService: PushTokenService = createPushTokenService();
