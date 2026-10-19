import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, supabaseConfigured } from '../lib/supabase';

// 로그인: Kakao through Supabase Auth. Like every network service here it
// never rejects — a failure comes back as false / null and the app carries on
// with what's on this device.

export interface AuthUser {
  id: string;
  /**
   * A guest account (Supabase anonymous sign-in), made so We Now works
   * without Kakao. 카카오로 로그인 later links Kakao to this same account.
   */
  anonymous?: boolean;
}

export interface AuthService {
  /** False without Supabase keys: no 로그인 button, everything stays on this device. */
  readonly available: boolean;
  current(): Promise<AuthUser | null>;
  /** Called with the signed-in user (or null) whenever that changes. Returns an unsubscribe. */
  onChange(listener: (user: AuthUser | null) => void): () => void;
  /** Leaves for Kakao's login page; false if that couldn't start. A guest's account is kept (Kakao is linked to it). */
  signInWithKakao(): Promise<boolean>;
  /** A guest account for this device, no Kakao; false if it couldn't be made (e.g. anonymous sign-ins are off). */
  signInAsGuest(): Promise<boolean>;
  signOut(): Promise<void>;
  /** Removes the account and everything stored under it on the server, then signs out. */
  deleteAccount(): Promise<boolean>;
}

const LOGIN_RETURN_PARAMS = ['code', 'error', 'error_code', 'error_description', 'state'];

/** Drops what Kakao's redirect left in the query (once used), keeping the path and any #hash. */
export function clearLoginReturn(): void {
  try {
    const url = new URL(window.location.href);
    if (!LOGIN_RETURN_PARAMS.some((p) => url.searchParams.has(p))) return;
    LOGIN_RETURN_PARAMS.forEach((p) => url.searchParams.delete(p));
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Not in a browser (tests) or history is locked: the query just stays.
  }
}

type ClientSource = () => Promise<SupabaseClient | null>;

export function createSupabaseAuthService(getClient: ClientSource = getSupabase, available = supabaseConfigured()): AuthService {
  const toUser = (user: { id: string; is_anonymous?: boolean } | null | undefined): AuthUser | null =>
    user?.id ? (user.is_anonymous ? { id: user.id, anonymous: true } : { id: user.id }) : null;

  return {
    available,

    async current() {
      try {
        const client = await getClient();
        if (!client) return null;
        // Waits for the client to finish a login that just came back (?code=).
        const { data } = await client.auth.getSession();
        clearLoginReturn();
        return toUser(data.session?.user);
      } catch {
        return null;
      }
    },

    onChange(listener) {
      let stopped = false;
      let unsubscribe: (() => void) | null = null;
      void getClient()
        .then((client) => {
          if (!client || stopped) return;
          const { data } = client.auth.onAuthStateChange((_event, session) => listener(toUser(session?.user)));
          unsubscribe = () => data.subscription.unsubscribe();
        })
        .catch(() => undefined);
      return () => {
        stopped = true;
        unsubscribe?.();
      };
    },

    async signInWithKakao() {
      try {
        const client = await getClient();
        if (!client) return false;
        // Back to this page without the hash: a share link that was open has
        // been handled by then, and the code comes back in the query.
        const redirectTo = `${window.location.origin}${window.location.pathname}`;
        // A guest keeps their account (groups, synced pins): Kakao is linked to
        // it. If that Kakao already has an account, linking fails and it's an
        // ordinary login into that one instead.
        const { data } = await client.auth.getSession();
        if (data.session?.user.is_anonymous) {
          const linked = await client.auth.linkIdentity({ provider: 'kakao', options: { redirectTo } });
          if (!linked.error) return true;
        }
        const { error } = await client.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo } });
        return !error;
      } catch {
        return false;
      }
    },

    async signInAsGuest() {
      try {
        const client = await getClient();
        if (!client) return false;
        const { data } = await client.auth.getSession();
        if (data.session) return true;
        const { error } = await client.auth.signInAnonymously();
        return !error;
      } catch {
        return false;
      }
    },

    async signOut() {
      try {
        const client = await getClient();
        await client?.auth.signOut();
      } catch {
        // Signed out locally anyway once the stored session is gone.
      }
    },

    async deleteAccount() {
      try {
        const client = await getClient();
        if (!client) return false;
        const { data } = await client.auth.getSession();
        const userId = data.session?.user.id;
        if (!userId) return false;
        // Storage isn't covered by the cascade: clear this user's folder first.
        const { data: files } = await client.storage.from('avatars').list(userId);
        if (files?.length) await client.storage.from('avatars').remove(files.map((f) => `${userId}/${f.name}`));
        const { error } = await client.rpc('delete_my_account');
        if (error) return false;
        await client.auth.signOut();
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const authService: AuthService = createSupabaseAuthService();
