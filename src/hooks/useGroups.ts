import { useCallback, useEffect, useRef, useState } from 'react';
import { dateKey } from '../domain/diary';
import type { Group } from '../domain/groups';
import type { AuthUser } from '../services/authService';
import { groupService as defaultService, readInviteSlug, type GroupService, type PhotoPing } from '../services/groupService';

export type GroupsStatus = 'unavailable' | 'signed-out' | 'loading' | 'ready' | 'error';

export interface Groups {
  status: GroupsStatus;
  groups: Group[];
  refresh(): void;
  create(name: string, cover: number, inviteSlug?: string): Promise<{ id: string; inviteSlug: string } | null>;
  rename(id: string, name: string): Promise<boolean>;
  leave(id: string): Promise<boolean>;
  kick(id: string, userId: string): Promise<boolean>;
  setAlias(id: string, alias: string): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  /** A camera photo and where it was taken, to each of `groupIds`; how many got it. */
  sendPhoto(groupIds: string[], ping: PhotoPing, photo: string): Promise<number>;
}

/** While We Now is open the pings are asked for again this often (others keep adding theirs). */
const REFRESH_MS = 60_000;

/**
 * We Now's groups, read from the server while `active` (and signed in), again
 * when the app comes back to the front and every minute meanwhile. A group
 * invite link (#g=) opened here is joined once signed in; `onJoined` gets the
 * group, `onNeedLogin` is told when there's no one to join as yet.
 */
export function useGroups(
  user: AuthUser | null,
  active: boolean,
  events: { onJoined(id: string): void; onNeedLogin(): void; onJoinFailed(): void },
  service: GroupService = defaultService,
): Groups {
  const [groups, setGroups] = useState<Group[]>([]);
  const [status, setStatus] = useState<GroupsStatus>(service.available ? (user ? 'loading' : 'signed-out') : 'unavailable');
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const userId = user?.id ?? null;
  // Answers from before a sign-out (or another account) are dropped.
  const generation = useRef(0);

  const refresh = useCallback(() => {
    if (!service.available) return setStatus('unavailable');
    if (!userId) {
      setGroups([]);
      return setStatus('signed-out');
    }
    const asked = generation.current;
    void service.list(dateKey()).then((result) => {
      if (asked !== generation.current) return;
      if (result === 'error') return setStatus((s) => (s === 'ready' ? s : 'error'));
      setGroups(result);
      setStatus('ready');
    });
  }, [service, userId]);

  useEffect(() => {
    generation.current += 1;
    setGroups([]);
    setStatus(service.available ? (userId ? 'loading' : 'signed-out') : 'unavailable');
  }, [service, userId]);

  useEffect(() => {
    if (!active) return;
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    const onShow = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [active, refresh]);

  // A group invite in the address: joined as soon as there's an account to join with.
  // Also one opened while the app is already up (only the #hash changes, no reload).
  const [invite, setInvite] = useState<string | null>(() => readInviteSlug(window.location.href));
  useEffect(() => {
    const onHash = () => {
      const slug = readInviteSlug(window.location.href);
      if (slug) setInvite(slug);
    };
    window.addEventListener('hashchange', onHash);
    // Native startup can deliver a link between the initial render and this effect.
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    const slug = invite;
    if (!slug) return;
    if (window.location.hash) history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`);
    if (!service.available) {
      setInvite(null);
      return eventsRef.current.onJoinFailed();
    }
    if (!userId) return eventsRef.current.onNeedLogin();
    setInvite(null);
    void service.join(slug).then(async (id) => {
      if (typeof id !== 'string') return eventsRef.current.onJoinFailed();
      // Opened once the list has it: an open group missing from the list closes itself.
      const list = await service.list(dateKey());
      if (list !== 'error') {
        setGroups(list);
        setStatus('ready');
      }
      eventsRef.current.onJoined(id);
    });
  }, [invite, service, userId, refresh]);

  const create = useCallback(
    async (name: string, cover: number, inviteSlug?: string) => {
      const made = await service.create(name, cover, inviteSlug);
      if (made) refresh();
      return made;
    },
    [service, refresh],
  );
  const rename = useCallback(
    async (id: string, name: string) => {
      const ok = await service.rename(id, name);
      if (ok) refresh();
      return ok;
    },
    [service, refresh],
  );
  const leave = useCallback(
    async (id: string) => {
      const ok = await service.leave(id);
      if (ok) setGroups((list) => list.filter((g) => g.id !== id));
      return ok;
    },
    [service],
  );

  const kick = useCallback(
    async (id: string, userId: string) => {
      const ok = await service.kick(id, userId);
      if (ok) setGroups((list) => list.map((g) => (g.id === id ? { ...g, members: g.members.filter((m) => m.userId !== userId) } : g)));
      return ok;
    },
    [service],
  );

  const setAlias = useCallback(
    async (id: string, alias: string) => {
      const ok = await service.setAlias(id, alias);
      if (ok) refresh();
      return ok;
    },
    [service, refresh],
  );
  const remove = useCallback(
    async (id: string) => {
      const ok = await service.remove(id);
      if (ok) setGroups((list) => list.filter((g) => g.id !== id));
      return ok;
    },
    [service],
  );

  const sendPhoto = useCallback(
    async (groupIds: string[], ping: PhotoPing, photo: string) => {
      const sent = await service.sendPhoto(groupIds, ping, photo);
      if (sent) refresh();
      return sent;
    },
    [service, refresh],
  );

  return { status, groups, refresh, create, rename, leave, kick, setAlias, remove, sendPhoto };
}
