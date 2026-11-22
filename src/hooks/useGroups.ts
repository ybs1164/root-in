import { useCallback, useEffect, useRef, useState } from 'react';
import { dateKey } from '../domain/diary';
import type { Group, PingDays } from '../domain/groups';
import type { ThemeId } from '../domain/decor';
import type { AuthUser } from '../services/authService';
import { clearGroupsCache, loadGroupsCache, saveGroupsCache } from '../services/groupsCache';
import { forgetReads, readOnce, recall, remember } from '../lib/readCache';
import { groupService as defaultService, readInviteSlug, type GroupService, type PhotoPing } from '../services/groupService';

export type GroupsStatus = 'unavailable' | 'signed-out' | 'loading' | 'ready' | 'error';

export interface Groups {
  status: GroupsStatus;
  groups: Group[];
  refresh(): void;
  create(name: string, cover: number, inviteSlug?: string, swatch?: ThemeId): Promise<{ id: string; inviteSlug: string } | null>;
  rename(id: string, name: string): Promise<boolean>;
  setCover(id: string, cover: number, photo?: string | null, swatch?: ThemeId): Promise<boolean>;
  leave(id: string): Promise<boolean>;
  kick(id: string, userId: string): Promise<boolean>;
  setAlias(id: string, alias: string): Promise<boolean>;
  setColor(id: string, color: number): Promise<boolean>;
  setProfile(id: string, own: boolean, alias: string, photo?: string | null): Promise<boolean>;
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
  // The copy kept on this phone: the list opens on it while the server is asked (services/groupsCache.ts).
  const copy = useRef<ReturnType<typeof loadGroupsCache> | undefined>(undefined);
  if (copy.current === undefined) copy.current = service.available ? loadGroupsCache() : null;
  const [groups, setGroups] = useState<Group[]>(() => copy.current?.groups ?? []);
  const [status, setStatus] = useState<GroupsStatus>(() =>
    !service.available ? 'unavailable' : copy.current ? 'ready' : user ? 'loading' : 'signed-out',
  );
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const userId = user?.id ?? null;
  // Answers from before a sign-out (or another account) are dropped.
  const generation = useRef(0);
  // Whose groups are on screen (the copy's account, at first), and whether
  // anyone has been signed in yet — before that, no one is only "not known yet".
  const shownFor = useRef<string | null>(copy.current?.userId ?? null);
  const everSignedIn = useRef(false);
  const waitingForAccount = () => !everSignedIn.current && shownFor.current !== null;

  const refresh = useCallback(() => {
    if (!service.available) return setStatus('unavailable');
    if (!userId) {
      // Still finding out who's signed in: the copy stays up.
      if (waitingForAccount()) return;
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
    if (!service.available) return setStatus('unavailable');
    if (userId) everSignedIn.current = true;
    // The copy was this account's: it stays up until the server answers.
    if (userId && userId === shownFor.current) return;
    if (!userId && waitingForAccount()) return;
    generation.current += 1;
    // Another account, or signed out: nothing of the last one's stays.
    if (shownFor.current !== null) {
      forgetReads();
      if (!userId) clearGroupsCache();
    }
    shownFor.current = userId;
    setGroups([]);
    setStatus(userId ? 'loading' : 'signed-out');
  }, [service, userId]);

  // The list as it now is, kept for the next time the app opens.
  useEffect(() => {
    if (userId && status === 'ready' && shownFor.current === userId) saveGroupsCache(userId, groups);
  }, [userId, status, groups]);

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
    async (name: string, cover: number, inviteSlug?: string, swatch?: ThemeId) => {
      const made = await service.create(name, cover, inviteSlug, swatch);
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
  const setCover = useCallback(
    async (id: string, cover: number, photo?: string | null, swatch?: ThemeId) => {
      const ok = await service.setCover(id, cover, photo, swatch);
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
  const setProfile = useCallback(
    async (id: string, own: boolean, alias: string, photo?: string | null) => {
      const ok = await service.setProfile(id, own, alias, photo);
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

  return { status, groups, refresh, create, rename, setCover, leave, kick, setAlias, setColor, setProfile, remove, sendPhoto };
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
    // A day seen before opens on what it had (and is read again behind it).
    const kept = recall<Group[]>(dayKey(day));
    setState(kept ? { day, status: 'ready', groups: kept } : { day, status: 'loading', groups: [] });
    if (!service.available || !userId) return setState({ day, status: 'error', groups: [] });
    let live = true;
    void readOnce(dayKey(day), () => service.list(day)).then((result) => {
      if (!live) return;
      if (result === 'error') return setState((now) => (now.day === day && now.status === 'ready' ? now : { day, status: 'error', groups: [] }));
      setState({ day, status: 'ready', groups: result });
      // The day before is the next one likely asked for (`<`): read ahead, quietly.
      const before = prevDay(day);
      if (!recall(dayKey(before))) void readOnce(dayKey(before), () => service.list(before));
    });
    return () => {
      live = false;
    };
  }, [day, service, userId]);
  if (state.day === day) return state;
  const kept = day ? recall<Group[]>(dayKey(day)) : undefined;
  return kept ? { status: 'ready', groups: kept } : { status: 'loading', groups: [] };
}

const dayKey = (day: string) => `groups-on:${day}`;

/** Reads a past day's groups ahead (a group's calendar, say), so opening it shows them at once. */
export function prefetchGroupsOnDay(day: string, service: GroupService = defaultService): void {
  if (!service.available || day >= dateKey() || recall(dayKey(day))) return;
  void readOnce(dayKey(day), () => service.list(day));
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
    // A month seen before opens on what it had, and is read again behind it.
    const kept = recall<PingDays>(`ping-days:${key}`);
    setState(kept ? { key, status: 'ready', days: kept } : { key, status: 'loading', days: {} });
    if (!service.available || !userId) return setState({ key, status: 'error', days: {} });
    let live = true;
    void (async () => {
      const asked = await service.pingDays(groupId, from, to);
      if (asked !== 'error') {
        remember(`ping-days:${key}`, asked);
        return live && setState({ key, status: 'ready', days: asked });
      }
      const today = dateKey();
      const dayList: string[] = [];
      for (let d = from; d <= to && d <= today; d = nextDay(d)) dayList.push(d);
      const lists = await Promise.all(dayList.map((d) => service.list(d)));
      if (!live) return;
      const days: PingDays = {};
      lists.forEach((list, i) => {
        if (list === 'error') return;
        const ids = list.find((g) => g.id === groupId)?.members.filter((m) => m.pings.some((p) => p.photo)).map((m) => m.userId) ?? [];
        if (ids.length) days[dayList[i]] = ids;
      });
      const failed = lists.length > 0 && lists.every((l) => l === 'error');
      if (!failed) remember(`ping-days:${key}`, days);
      setState({ key, status: failed ? 'error' : 'ready', days });
    })();
    return () => {
      live = false;
    };
  }, [key, groupId, from, to, service, userId]);
  if (state.key === key) return state;
  const kept = key ? recall<PingDays>(`ping-days:${key}`) : undefined;
  return kept ? { status: 'ready', days: kept } : { status: 'loading', days: {} };
}

function prevDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + 1));
}
