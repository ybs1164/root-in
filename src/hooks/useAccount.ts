import { useEffect, useMemo, useRef, useState } from 'react';
import { getDisplayName, setDisplayName } from '../lib/currentUser';
import { createAccountSync } from '../services/accountSync';
import { createCloudSync } from '../services/cloudSync';
import { remoteDataService as defaultData, type RemoteDataService } from '../services/remoteDataService';
import { applyShareCounts } from '../services/shareCounts';
import { shareLinkService as defaultLinks, type ShareLinkService } from '../services/shareLinkService';
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
  data: RemoteDataService = defaultData,
  links: ShareLinkService = defaultLinks,
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

  // 핀·루트·하루: merged with the account after the profile, then kept in step.
  const [cloudProblem, setCloudProblem] = useState(false);
  const cloud = useMemo(() => (auth.available ? createCloudSync({ remote: data, onProblem: setCloudProblem }) : null), [auth.available, data]);
  useEffect(() => cloud?.watchLocal(), [cloud]);

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
      cloud?.signedOut();
      return;
    }
    // How often each route's links were opened (N Shares): after the routes themselves are in.
    const pullCounts = async () => {
      const totals = await links.counts(userId);
      if (totals !== 'error') applyShareCounts(totals);
    };
    setBusy(true);
    void sync
      .signedIn(userId)
      .then(() => cloud?.signedIn(userId))
      .then(pullCounts)
      .finally(() => setBusy(false));
    // Back to the front (another phone may have changed things, or someone opened a link): pull again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void cloud?.refresh().then(pullCounts);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, sync, cloud, links]);

  return {
    available: auth.available,
    user,
    busy,
    note: note ?? (cloudProblem ? '핀·루트를 서버와 맞추지 못했어요. 이 기기에 저장한 것은 그대로고, 다시 열면 또 시도해요.' : null),
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
