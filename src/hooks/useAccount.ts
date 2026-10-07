import { useEffect, useMemo, useRef, useState } from 'react';
import { getDisplayName, setDisplayName } from '../lib/currentUser';
import { createAccountSync } from '../services/accountSync';
import { authService as defaultAuth, type AuthService, type AuthUser } from '../services/authService';
import type { Profile } from '../services/profileRepository';
import { remoteProfileService as defaultRemote, type RemoteProfileService } from '../services/remoteProfileService';

export interface Account {
  /** False without Supabase keys: no 로그인, the app works on this device only. */
  available: boolean;
  user: AuthUser | null;
  /** Waiting on Kakao / the server (buttons stay disabled meanwhile). */
  busy: boolean;
  /** A line for the profile popup when something didn't go through. */
  note: string | null;
  signIn(): void;
  signOut(): void;
  /** 탈퇴 on the server; false when it didn't happen (then nothing on this device is cleared either). */
  deleteAccount(): Promise<boolean>;
  /** Send this device's profile (after a change) up to the account. */
  push(profile: Profile, nickname?: string): void;
}

/**
 * 로그인 + 프로필 동기화. `profile` is the app's current one; `apply` puts a
 * profile from the account on this device (state + storage) without pushing.
 */
export function useAccount(
  profile: Profile,
  apply: (profile: Profile) => void,
  auth: AuthService = defaultAuth,
  remote: RemoteProfileService = defaultRemote,
): Account {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const sync = useMemo(
    () =>
      createAccountSync({
        remote,
        local: () => ({ profile: profileRef.current, nickname: getDisplayName() }),
        apply: ({ profile: next, nickname }) => {
          applyRef.current(next);
          setDisplayName(nickname);
        },
        note: setNote,
      }),
    [remote],
  );

  useEffect(() => {
    if (!auth.available) return;
    let alive = true;
    void auth.current().then((current) => {
      if (alive) setUser((was) => was ?? current);
    });
    const stop = auth.onChange((next) => setUser(next));
    return () => {
      alive = false;
      stop();
    };
  }, [auth]);

  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      sync.signedOut();
      return;
    }
    setBusy(true);
    void sync.signedIn(userId).finally(() => setBusy(false));
  }, [userId, sync]);

  return {
    available: auth.available,
    user,
    busy,
    note,
    signIn() {
      setBusy(true);
      void auth.signInWithKakao().then((started) => {
        // On success the page is already leaving for Kakao.
        if (!started) {
          setBusy(false);
          setNote('로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
        }
      });
    },
    signOut() {
      setBusy(true);
      void auth.signOut().finally(() => {
        setUser(null);
        setBusy(false);
      });
    },
    async deleteAccount() {
      setBusy(true);
      const done = await auth.deleteAccount();
      setBusy(false);
      if (done) setUser(null);
      else setNote('탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요.');
      return done;
    },
    push(next, nickname = getDisplayName()) {
      void sync.push({ profile: next, nickname });
    },
  };
}
