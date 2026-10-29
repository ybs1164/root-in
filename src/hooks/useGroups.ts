import { useCallback, useEffect, useRef, useState } from 'react';
import { dateKey } from '../domain/diary';
import type { Group, PingDays } from '../domain/groups';
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
  setColor(id: string, color: number): Promise<boolean>;
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
  const setColor = useCallback(
    async (id: string, color: number) => {
      const ok = await service.setColor(id, color);
      // At once, so the map and the faces change before the next read.
      if (ok) setGroups((list) => list.map((g) => (g.id === id ? { ...g, members: g.members.map((m) => (m.userId === userId ? { ...m, color } : m)) } : g)));
      refresh();
      return ok;
    },
    [service, refresh, userId],
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

  return { status, groups, refresh, create, rename, leave, kick, setAlias, setColor, remove, sendPhoto };
}

export type GroupDayStatus = 'loading' | 'ready' | 'error';

/**
 * A past day's groups for a group's map paged back with its `<` `>`: read
 * once per day asked (a day gone by hardly changes), null = today (the live
 * list above). Answers for a day no longer asked are dropped.
 */
export function useGroupsOnDay(user: AuthUser | null, day: string | null, service: GroupService = defaultService): { status: GroupDayStatus; groups: Group[] } {
  const [state, setState] = useState<{ day: string | null; status: GroupDayStatus; groups: Group[] }>({ day: null, status: 'loading', groups: [] });
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!day) return;
    setState({ day, status: 'loading', groups: [] });
    if (!service.available || !userId) return setState({ day, status: 'error', groups: [] });
    let live = true;
    void service.list(day).then((result) => {
      if (!live) return;
      setState(result === 'error' ? { day, status: 'error', groups: [] } : { day, status: 'ready', groups: result });
    });
    return () => {
      live = false;
    };
  }, [day, service, userId]);
  return state.day === day ? state : { status: 'loading', groups: [] };
}

/**
 * A group's calendar month (`from`..`to`, YYYY-MM-DD): who pinged on each day.
 * Asked in one go (group_ping_days); where the server doesn't have that yet,
 * day by day through `list` (only the days up to today), so the calendar works
 * either way. null `groupId` = closed.
 */
export function useGroupPingDays(
  user: AuthUser | null,
  groupId: string | null,
  from: string,
  to: string,
  service: GroupService = defaultService,
): { status: GroupDayStatus; days: PingDays } {
  const [state, setState] = useState<{ key: string; status: GroupDayStatus; days: PingDays }>({ key: '', status: 'loading', days: {} });
  const userId = user?.id ?? null;
  const key = groupId ? `${groupId}|${from}|${to}` : '';
  useEffect(() => {
    if (!groupId) return;
    setState({ key, status: 'loading', days: {} });
    if (!service.available || !userId) return setState({ key, status: 'error', days: {} });
    let live = true;
    void (async () => {
      const asked = await service.pingDays(groupId, from, to);
      if (asked !== 'error') return live && setState({ key, status: 'ready', days: asked });
      const today = dateKey();
      const dayList: string[] = [];
      for (let d = from; d <= to && d <= today; d = nextDay(d)) dayList.push(d);
      const lists = await Promise.all(dayList.map((d) => service.list(d)));
      if (!live) return;
      const days: PingDays = {};
      lists.forEach((list, i) => {
        if (list === 'error') return;
        const ids = list.find((g) => g.id === groupId)?.members.filter((m) => m.pings.length > 0).map((m) => m.userId) ?? [];
        if (ids.length) days[dayList[i]] = ids;
      });
      const failed = lists.length > 0 && lists.every((l) => l === 'error');
      setState({ key, status: failed ? 'error' : 'ready', days });
    })();
    return () => {
      live = false;
    };
  }, [key, groupId, from, to, service, userId]);
  return state.key === key ? state : { status: 'loading', days: {} };
}

function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + 1));
}
