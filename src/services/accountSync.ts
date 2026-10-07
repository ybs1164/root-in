import { defaultHandle } from '../domain/profile';
import type { Profile } from './profileRepository';
import { profileChanged } from './profileSync';
import type { AccountProfile, RemoteProfileService } from './remoteProfileService';

// What happens to the profile around 로그인, kept out of React so it can be
// tested: on sign-in the account's profile replaces this device's (or, on the
// very first sign-in, this device's becomes the account's); after that every
// change is sent up, one at a time, newest last.

export const ACCOUNT_NOTES = {
  offline: '서버에 연결하지 못했어요. 이 기기에 저장한 것은 그대로예요.',
  saveFailed: '서버에 저장하지 못했어요. 다음에 바꿀 때 다시 보내요.',
  handleTaken: '이미 다른 사람이 쓰는 아이디예요.',
} as const;

export interface AccountSyncDeps {
  remote: RemoteProfileService;
  /** This device's profile and nickname right now. */
  local: () => AccountProfile;
  /** Puts a profile (and nickname) on this device without sending it back up. */
  apply: (account: AccountProfile) => void;
  note: (text: string | null) => void;
}

export interface AccountSync {
  /** A user signed in (or the page opened signed in): bring the two profiles together. */
  signedIn(userId: string): Promise<void>;
  signedOut(): void;
  /** This device's profile changed: send it up once signed in and synced. */
  push(next: AccountProfile): Promise<void>;
}

export function createAccountSync({ remote, local, apply, note }: AccountSyncDeps): AccountSync {
  let userId: string | null = null;
  // What the server is known to hold; null until the first sync has landed.
  let sent: AccountProfile | null = null;
  let queue: Promise<void> = Promise.resolve();
  let latest: AccountProfile | null = null;

  const send = async (id: string, next: AccountProfile) => {
    const before = sent;
    if (!before || !profileChanged(next, before)) return;
    const result = await remote.push(id, next, next.profile.photo !== before.profile.photo);
    if (userId !== id) return; // signed out (or in as someone else) meanwhile
    if (result === 'ok') {
      sent = next;
      note(null);
    } else if (result === 'handle-taken') {
      // Back to the @아이디 the server has; the rest is sent as is.
      const kept = { ...next, profile: { ...next.profile, handle: before.profile.handle } };
      apply(kept);
      latest = kept;
      note(ACCOUNT_NOTES.handleTaken);
      if (profileChanged(kept, before)) await send(id, kept);
    } else {
      note(ACCOUNT_NOTES.saveFailed);
    }
  };

  return {
    async signedIn(id) {
      if (userId === id && sent) return;
      userId = id;
      sent = null;
      const here = local();
      const there = await remote.fetch(id, here.profile);
      if (userId !== id) return;
      if (there === 'error') {
        note(ACCOUNT_NOTES.offline);
        userId = null; // so the next sign-in event tries again
        return;
      }
      if (there) {
        apply(there);
        sent = there;
        note(null);
        return;
      }
      // First sign-in: this device's profile becomes the account's. If its
      // @아이디 is taken, fall back to one made from the account id.
      let first: AccountProfile = here;
      let result = await remote.push(id, first, !!first.profile.photo);
      if (result === 'handle-taken') {
        first = { ...here, profile: { ...here.profile, handle: defaultHandle(id) } satisfies Profile };
        result = await remote.push(id, first, !!first.profile.photo);
        if (result === 'ok') apply(first);
      }
      if (userId !== id) return;
      if (result === 'ok') {
        sent = first;
        note(null);
      } else {
        note(result === 'handle-taken' ? ACCOUNT_NOTES.handleTaken : ACCOUNT_NOTES.offline);
        userId = null;
      }
    },

    signedOut() {
      userId = null;
      sent = null;
      latest = null;
    },

    push(next) {
      latest = next;
      // One request at a time; each sends whatever is newest when its turn comes.
      queue = queue.then(async () => {
        const id = userId;
        const newest = latest;
        if (!id || !newest) return;
        await send(id, newest);
      });
      return queue;
    },
  };
}
