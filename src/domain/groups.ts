import type { StoredPing } from './dayPings';
/** We Now: a group whose members see each other's TODAY pings on one map. */
export interface GroupPing {
  at: string;
  center: [number, number];
  /** The place's name (shown while its member is picked); missing from older servers. */
  name?: string;
  /** The photo sent with it from the camera (not built yet, so never set for now). */
  photo?: string;
}

export interface GroupMember {
  userId: string;
  /** The member's colour slot in the group (0..19), kept while they stay. */
  slot: number;
  /** The name shown in the group: their 별명 there, else their profile nickname. */
  nickname: string;
  /** Their own name for this group (내 별명), null = the profile nickname. */
  alias: string | null;
  /** Public URL of their profile photo, or null. */
  photo: string | null;
  /** Today's pings, oldest first. */
  pings: GroupPing[];
}

export interface Group {
  id: string;
  name: string;
  cover: number;
  inviteSlug: string;
  /** Whether I made it (only the maker renames it). */
  mine: boolean;
  members: GroupMember[];
}

export const GROUP_LIMITS = { name: 12, alias: 20, members: 20, pingsPerMember: 200, covers: 4 } as const;

/** A member's colour: the pin palette in turn (it repeats past eight). */
export const memberColor = (slot: number): string => `var(--pin-${(slot % 8) + 1})`;

/** The first letter of a nickname, for a member without a photo. */
export const memberInitial = (nickname: string): string => [...nickname.trim()][0] ?? '?';

export function cleanGroupName(name: string): string {
  return name.trim().slice(0, GROUP_LIMITS.name);
}

export const groupPingCount = (group: Group): number => group.members.reduce((n, m) => n + m.pings.length, 0);

/** The group beside `id` in the list (`<` = -1, `>` = 1), going round at the ends. */
export function neighborGroup(groups: Group[], id: string, dir: -1 | 1): Group | null {
  const i = groups.findIndex((g) => g.id === id);
  if (i < 0 || groups.length < 2) return null;
  return groups[(i + dir + groups.length) % groups.length];
}

/** Every ping centre on show: one member's, or the whole group's. */
export function focusPoints(group: Group, memberId: string | null): [number, number][] {
  const members = memberId ? group.members.filter((m) => m.userId === memberId) : group.members;
  return members.flatMap((m) => m.pings.map((p) => p.center));
}

/**
 * The pings drawn into a `size`-square tile (its mini map): longitude and
 * latitude kept to one scale (a degree of longitude is shorter than one of
 * latitude here), the whole group fitted in with a margin and centred.
 */
export function tilePaths(group: Group, size: number, margin = size * 0.16): { color: string; points: [number, number][] }[] {
  const at = tileProjection(group.members.flatMap((m) => m.pings.map((p) => p.center)), size, margin);
  if (!at) return [];
  return group.members.filter((m) => m.pings.length).map((m) => ({ color: memberColor(m.slot), points: m.pings.map((p) => at(p.center)) }));
}

/** Lng/lat → tile coordinates fitting every point in, north up; null without points. */
function tileProjection(all: readonly [number, number][], size: number, margin: number): ((c: [number, number]) => [number, number]) | null {
  if (all.length === 0) return null;
  const lat0 = all.reduce((s, c) => s + c[1], 0) / all.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = all.map((c) => c[0] * kx);
  const ys = all.map((c) => c[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY);
  const scale = span > 0 ? (size - margin * 2) / span : 0;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return (c) => [
    Math.round((size / 2 + (c[0] * kx - cx) * scale) * 10) / 10,
    // North is up: latitude grows the other way from SVG's y.
    Math.round((size / 2 - (c[1] - cy) * scale) * 10) / 10,
  ];
}

/** How many members the rail shows folded (after ALL); ↓ opens the rest. */
export const RAIL_FOLDED_MEMBERS = 3;

/**
 * The `<` `>` in the middle of a group's map: one member after another in
 * the rail's order, ALL before the first and after the last, going round.
 */
export function stepMember(group: Group, picked: string | null, dir: -1 | 1): string | null {
  const order: (string | null)[] = [null, ...group.members.map((m) => m.userId)];
  const i = Math.max(0, order.indexOf(picked));
  return order[(i + dir + order.length) % order.length];
}

/** One member's ping, told apart from the rest of the day's (the server sends no id). */
export const groupPingKey = (member: GroupMember, ping: GroupPing): string => `${member.userId}|${ping.at}`;

/** Every ping on the group's map right now: what opening it has seen. */
export const groupPingKeys = (group: Group): string[] => group.members.flatMap((m) => m.pings.map((p) => groupPingKey(m, p)));

/**
 * The tile's 새 핑 badge: other members' pings that weren't on the map when I
 * last opened this group (`seen`; never opened = all of theirs). Mine never count.
 */
export function newPingCount(group: Group, me: string | null, seen: readonly string[] | undefined): number {
  const known = new Set(seen ?? []);
  return group.members.filter((m) => m.userId !== me).reduce((n, m) => n + m.pings.filter((p) => !known.has(groupPingKey(m, p))).length, 0);
}

/**
 * My own pings on a group's map, from this phone's storage rather than the
 * server's copy, so adding or taking one out of TODAY shows at once (the
 * server only catches up after the next push and the next read). 제외 주소
 * pings (`local`) stay off it, as they never reach the server either.
 */
export function myGroupPings(stored: readonly StoredPing[], day: string): GroupPing[] {
  return stored
    .filter((p) => p.day === day && !p.local)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
    .map((p) => ({ at: p.at, center: p.center, name: p.name }));
}
