import { haversineMeters } from './geo';
import type { LineLook, PingLook, StoredPing } from './dayPings';
import { dateKey } from './diary';
/** We Now: a group whose members see each other's TODAY pings on one map. */
export interface GroupPing {
  at: string;
  center: [number, number];
  /** The place's name (shown while its member is picked); missing from older servers. */
  name?: string;
  /** The photo sent with it from the camera (its address; the dev demo members' are drawn data URLs) — the newest, with several. */
  photo?: string;
  /** Every photo sent from this place in a row (`mergeSamePlace`), oldest first; only when there are two or more. */
  photos?: string[];
  /** When each of its photos (`pingPhotos`) was taken, same order; set on merged places, whose `at` is their last ping's. */
  photoAts?: string[];
  /** My own row only: the TODAY pings (this phone's ids) the place is made of — what 핀 삭제 hides from a group. */
  ids?: string[];
  /** A merged place: its first ping's time (`at` is its last's) — what its look is kept by, as a new photo there moves `at`. */
  from?: string;
}

/**
 * How a member drew their pings and the lines between them in one group
 * (long-pressed on its map, their own only): a shape per ping, a style per
 * leg, by `pingLookKey` / `edgeLookKey`. Missing = the plain pin, the solid line.
 */
export interface GroupLooks {
  pings: Record<string, PingLook>;
  edges: Record<string, LineLook>;
}

export const GROUP_LOOK_LIMIT = 600;
const PING_LOOKS: readonly PingLook[] = ['transparent', 'pin', 'dot', 'star', 'heart'];
const LINE_LOOKS: readonly LineLook[] = ['transparent', 'solid', 'dashed', 'dotted', 'bold'];
const LOOK_KEY = /^[0-9T:.\-Z>]{10,120}$/;

/** A ping's key in `GroupLooks.pings`: when it began (its first ping's time). */
export const pingLookKey = (ping: GroupPing): string => ping.from ?? ping.at;

/**
 * A group's day as a whiteboard (its 꾸미기): the doodle key that stands for
 * it where a photo's path would (the same layers, tools and saving).
 */
export const dayDecorKey = (groupId: string, day: string): string => `day:${groupId}:${day}`;
const DAY_DECOR_KEY = /^day:([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2})$/;
/** The group and day of a `dayDecorKey`; null for anything else (a photo's path). */
export function readDayDecorKey(key: string): { groupId: string; day: string } | null {
  const m = DAY_DECOR_KEY.exec(key);
  return m ? { groupId: m[1], day: m[2] } : null;
}
/** A leg's key in `GroupLooks.edges`: its two ends' keys. */
export const edgeLookKey = (from: GroupPing, to: GroupPing): string => `${pingLookKey(from)}>${pingLookKey(to)}`;

/** A member's looks as the server sent them, checked; undefined when there are none worth keeping. */
export function readGroupLooks(raw: unknown): GroupLooks | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const pick = <T extends string>(value: unknown, allowed: readonly T[]): Record<string, T> => {
    const out: Record<string, T> = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
    for (const [key, look] of Object.entries(value).slice(0, GROUP_LOOK_LIMIT)) {
      if (LOOK_KEY.test(key) && allowed.includes(look as T)) out[key] = look as T;
    }
    return out;
  };
  const { pings, edges } = raw as Record<string, unknown>;
  const looks = { pings: pick(pings, PING_LOOKS), edges: pick(edges, LINE_LOOKS) };
  return Object.keys(looks.pings).length || Object.keys(looks.edges).length ? looks : undefined;
}

/** `looks` with one ping's or leg's look set (null: back to the plain pin / solid line). */
export function withGroupLook(looks: GroupLooks | undefined, kind: 'ping' | 'edge', key: string, look: PingLook | LineLook | null): GroupLooks {
  const next: GroupLooks = { pings: { ...looks?.pings }, edges: { ...looks?.edges } };
  const bag = (kind === 'ping' ? next.pings : next.edges) as Record<string, string>;
  if (look === null) delete bag[key];
  else bag[key] = look;
  return next;
}

export interface GroupMember {
  userId: string;
  /** The member's place in the group's order (0..19), kept while they stay. */
  slot: number;
  /** Their colour (`MEMBER_COLORS` index, 0..19): picked in 그룹 설정, never two the same in a group. */
  color: number;
  /** The name shown in the group: their 별명 there, else their profile nickname. */
  nickname: string;
  /** Their own name for this group (내 별명), null = the profile nickname. */
  alias: string | null;
  /** Public URL of the photo the group shows (their 개별 one, else the profile's), or null. */
  photo: string | null;
  /** 개별 프로필: this group shows its own photo and name for them, not their profile's. */
  ownProfile?: boolean;
  /** My own row only: the group's photo (URL) and name as stored, shown in 그룹 설정 even while I use 통합. */
  groupProfile?: { alias: string | null; photo: string | null };
  /** Today's pings, oldest first. */
  pings: GroupPing[];
  /** How they drew their pings and lines in this group (`GroupLooks`); none = the plain ones. */
  looks?: GroupLooks;
}

export interface Group {
  id: string;
  name: string;
  cover: number;
  /** The group's own cover photo (URL), picked from the gallery: shown in place of `cover`'s pattern. */
  coverPhoto?: string;
  inviteSlug: string;
  /** Whether I made it (only the maker renames it). */
  mine: boolean;
  members: GroupMember[];
  /** When it was made (ISO), if the server said: its day wears a yellow star in the 대화's calendar. */
  createdAt?: string;
}

export const GROUP_LIMITS = { name: 12, alias: 20, members: 20, pingsPerMember: 200, covers: 7 } as const;

/**
 * Two pings this close are the same place. By distance, not by place id: the
 * same café pinged from a phone on Kakao and one on the OSM fallback has two
 * different ids (and names spelled differently).
 */
export const SAME_PLACE_M = 50;

/** A place two or more members pinged: one ping on the map for all of them. */
export interface SharedPlace {
  /** Where its one ping stands: the earliest of its pings' spots, so it stays put as more come. */
  center: [number, number];
  /** Every ping there, as (member, its place in their day), oldest first. */
  pings: { member: GroupMember; seq: number }[];
}

/**
 * Places at least two members pinged (each within `SAME_PLACE_M` of another
 * ping there — chained, so three friends a few metres apart in a row are
 * one place). Their pings land a little apart (each phone's own fix, or the
 * same café found on Kakao and on the OSM fallback), which zoomed in read as
 * different spots: the map draws each such place as one aurora ping at one
 * spot (2026-11-01). One member's own repeat visits alone don't make one.
 */
export function sharedPlaces(members: readonly GroupMember[]): SharedPlace[] {
  const all = members.flatMap((member) => member.pings.map((ping, seq) => ({ member, seq, ping })));
  const root = all.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  all.forEach((a, i) => {
    for (let j = i + 1; j < all.length; j++) {
      if (haversineMeters(a.ping.center, all[j].ping.center) <= SAME_PLACE_M) root[find(j)] = find(i);
    }
  });
  const groups = new Map<number, typeof all>();
  all.forEach((p, i) => {
    const k = find(i);
    groups.set(k, [...(groups.get(k) ?? []), p]);
  });
  return [...groups.values()]
    .filter((ps) => new Set(ps.map((p) => p.member.userId)).size >= 2)
    .map((ps) => {
      const sorted = [...ps].sort((x, y) => x.ping.at.localeCompare(y.ping.at));
      return { center: sorted[0].ping.center, pings: sorted.map(({ member, seq }) => ({ member, seq })) };
    });
}

/**
 * The member colours, one for each of a group's 20 places so no two members
 * share one (2026-10-31): the eight pin colours first (what members had
 * before), then twelve more. A joiner gets the first one nobody has.
 */
export const MEMBER_COLORS = Array.from({ length: GROUP_LIMITS.members }, (_, i) => i);

/** Each member colour's name (for screen readers), in `MEMBER_COLORS` order. */
export const MEMBER_COLOR_NAMES = [
  '하늘', '분홍', '노랑', '라일락', '연두', '회색', '산호', '청록', '남색', '보라',
  '장미', '민트', '파랑', '초록', '살구', '갈색', '자두', '올리브', '황금', '고동',
] as const;

/** A member's colour, as CSS. */
export const memberColor = (color: number): string => `var(--member-${Math.abs(Math.trunc(color)) % GROUP_LIMITS.members})`;

/** A member's colour as their doodles store it (`member-N`), by user id across `groups`, first group first; null for someone not in any. */
export function memberInk(groups: readonly Group[], userId: string): string | null {
  for (const g of groups) {
    const m = g.members.find((x) => x.userId === userId);
    if (m) return `member-${Math.abs(Math.trunc(m.color)) % GROUP_LIMITS.members}`;
  }
  return null;
}

/** The colours the other members of `group` have (mine is mine to change). */
export function takenColors(group: Group, me: string | null): Set<number> {
  return new Set(group.members.filter((m) => m.userId !== me).map((m) => m.color));
}

/** The first colour nobody in `members` has (what joining gives); null when all 20 are taken. */
export function firstFreeColor(members: readonly Pick<GroupMember, 'color'>[]): number | null {
  const used = new Set(members.map((m) => m.color));
  return MEMBER_COLORS.find((c) => !used.has(c)) ?? null;
}

/** Every pair of members who were at the same place (`SAME_PLACE_M`) on the day of `members`' pings, each pair once. */
export function metPairs(members: readonly GroupMember[]): [string, string][] {
  const pairs: [string, string][] = [];
  members.forEach((a, ai) => {
    for (const b of members.slice(ai + 1)) {
      if (b.userId === a.userId) continue;
      if (a.pings.some((pa) => b.pings.some((pb) => haversineMeters(pa.center, pb.center) <= SAME_PLACE_M))) pairs.push([a.userId, b.userId]);
    }
  });
  return pairs;
}

/**
 * One member's day with a place pinged several times in a row (photos sent
 * from the camera one after another there, say) as one ping: the latest
 * time — so a new photo still counts as new — the place's name, and every
 * photo, oldest first (drawn stacked, the newest on top). Going away and
 * coming back is another visit, so only pings next to each other merge.
 */
export function mergeSamePlace(pings: readonly GroupPing[]): GroupPing[] {
  const out: GroupPing[] = [];
  for (const p of pings) {
    const last = out[out.length - 1];
    const same = last && haversineMeters(last.center, p.center) <= SAME_PLACE_M && (!last.name || !p.name || last.name === p.name);
    if (!same) {
      out.push({ ...p });
      continue;
    }
    const photos = [...pingPhotos(last), ...pingPhotos(p)];
    const photoAts = [...pingPhotoAts(last), ...pingPhotoAts(p)];
    const merged: GroupPing = { at: p.at, center: last.center, from: last.from ?? last.at };
    const name = last.name ?? p.name;
    if (name) merged.name = name;
    if (photos.length) merged.photo = photos[photos.length - 1], merged.photoAts = photoAts;
    if (photos.length > 1) merged.photos = photos;
    const ids = [...(last.ids ?? []), ...(p.ids ?? [])];
    if (ids.length) merged.ids = ids;
    out[out.length - 1] = merged;
  }
  return out;
}

/**
 * A group photo's path (what stars and hearts go by, as in the gallery)
 * from the address a ping carries: the group-photos bucket's
 * <uuid>/<id>.jpg at its end. The dev demo members' drawn photos get a
 * `demo/` key of their own; any other address, none.
 */
export function photoKey(url: string | undefined): string | null {
  if (!url) return null;
  const path = /\/group-photos\/([0-9a-f-]{36}\/[A-Za-z0-9_-]{6,40}\.jpg)(?:[?#]|$)/.exec(url);
  if (path) return path[1];
  if (!url.startsWith('data:')) return null;
  let h = 2166136261;
  for (let i = 0; i < url.length; i++) h = Math.imul(h ^ url.charCodeAt(i), 16777619);
  return `demo/u${(h >>> 0).toString(36)}`;
}

/** The photos to draw over a ping, oldest first: all of them, or its one. */
export const pingPhotos = (ping: GroupPing): string[] => ping.photos ?? (ping.photo ? [ping.photo] : []);

/** Each photo in a member's day, oldest first, with its place and stack index for map selection. */
export function memberPhotoItems(pings: readonly GroupPing[]): { seq: number; photo: number; url: string }[] {
  return pings.flatMap((ping, seq) => pingPhotos(ping).map((url, photo) => ({ seq, photo, url })));
}

/** When each of `pingPhotos(ping)` was taken. */
const pingPhotoAts = (ping: GroupPing): string[] => ping.photoAts ?? (ping.photo ? [ping.at] : []);

/**
 * The time a picked place shows (HH:MM, local): its tapped photo's when it
 * has several, else the ping's own (its newest photo's, or when they were there).
 */
export function placeTime(ping: GroupPing, photo?: number): string {
  const ats = ping.photoAts;
  const at = (ats?.length ? ats[photo ?? ats.length - 1] : undefined) ?? ping.at;
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The first letter of a nickname, for a member without a photo. */
export const memberInitial = (nickname: string): string => [...nickname.trim()][0] ?? '?';

/**
 * My groups in the order I dragged them into (`order`, their ids); ones not
 * in it (new, or never moved) keep their own order after the rest.
 */
export function orderGroups<T extends { id: string }>(groups: readonly T[], order: readonly string[]): T[] {
  const at = new Map(order.map((id, i) => [id, i]));
  return groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (at.get(a.g.id) ?? order.length + a.i) - (at.get(b.g.id) ?? order.length + b.i))
    .map(({ g }) => g);
}

/** `ids` with `id` moved to index `to` (the others close up around it). */
export function moveId(ids: readonly string[], id: string, to: number): string[] {
  const rest = ids.filter((x) => x !== id);
  const at = Math.max(0, Math.min(rest.length, to));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

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
  return group.members.filter((m) => m.pings.length).map((m) => ({ color: memberColor(m.color), points: m.pings.map((p) => at(p.center)) }));
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

/**
 * The `<` `>` beside the pass: one member after another in the row's order,
 * going round from the last to the first — never ALL (that's its own button).
 * From ALL (or someone gone), `>` is the first member and `<` the last.
 */
export function stepMember(group: Group, picked: string | null, dir: -1 | 1): string | null {
  const order = group.members.map((m) => m.userId);
  if (order.length === 0) return null;
  const i = picked ? order.indexOf(picked) : -1;
  if (i < 0) return dir === 1 ? order[0] : order[order.length - 1];
  return order[(i + dir + order.length) % order.length];
}

/** One member's ping, told apart from the rest of the day's (the server sends no id). */
export const groupPingKey = (member: GroupMember, ping: GroupPing): string => `${member.userId}|${ping.at}`;

/** Every ping on the group's map right now: what opening it has seen. */
export const groupPingKeys = (group: Group): string[] => group.members.flatMap((m) => m.pings.map((p) => groupPingKey(m, p)));

/**
 * Which of a member's pings show their photo on the map: every one that has
 * a photo, always (2026-10-29 — the old caps of three, n − 2 and none while
 * someone else is picked or the panel is open are gone).
 */
export function photoPings(member: GroupMember): Set<number> {
  return new Set(member.pings.flatMap((p, i) => (p.photo ? [i] : [])));
}

/**
 * Paging the big photo (drag or ‹ ›): the photo before or after, stopping at
 * the ends rather than going round — null when there's nothing that way.
 */
export function viewerStep(seq: number, dir: -1 | 1, count: number): number | null {
  const next = seq + dir;
  return next >= 0 && next < count ? next : null;
}

/**
 * The pass's day: every place in order; a long one keeps the first and the
 * last few (null = the … between).
 */
export function passRoute(names: string[], keep = 5): (string | null)[] {
  if (names.length <= keep) return names;
  return [names[0], null, ...names.slice(-(keep - 2))];
}

/** A face's badge on a group's map: the member's pings since I last had them picked (`seen`; never = all of them). */
export function newMemberPings(member: GroupMember, seen: readonly string[] | undefined): number {
  const known = new Set(seen ?? []);
  return member.pings.filter((p) => !known.has(groupPingKey(member, p))).length;
}

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
/**
 * My row in a group: this phone's TODAY pings (fresher than the server's
 * copy) plus the photos I sent to that group, which only the server has.
 */
export function withSentPhotos(mine: readonly GroupPing[], fromServer: readonly GroupPing[]): GroupPing[] {
  const sent = fromServer.filter((p) => p.photo);
  if (!sent.length) return mine as GroupPing[];
  return [...mine, ...sent].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

export function myGroupPings(stored: readonly StoredPing[], day: string, hidden?: ReadonlySet<string>): GroupPing[] {
  return stored
    .filter((p) => p.day === day && !p.local && !hidden?.has(p.id))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
    .map((p) => ({ at: p.at, center: p.center, name: p.name, ids: [p.id] }));
}

/** A member's pings from the server without the photos I just deleted (before the next read drops them). */
export function withoutPhotos(pings: readonly GroupPing[], gone: ReadonlySet<string>): GroupPing[] {
  if (!gone.size) return pings as GroupPing[];
  return pings.filter((p) => !p.photo || !gone.has(photoKey(p.photo) ?? ''));
}

/** A group's calendar: day (YYYY-MM-DD) → the ids of the members who pinged that day, each once. */
export type PingDays = Record<string, string[]>;

/** The server's { day, user_id } pairs, checked like any answer: anything off is skipped. */
export function readPingDays(data: unknown): PingDays {
  const days: PingDays = {};
  if (!Array.isArray(data)) return days;
  for (const row of data.slice(0, 62 * GROUP_LIMITS.members)) {
    const day = (row as { day?: unknown })?.day;
    const user = (row as { user_id?: unknown })?.user_id;
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || typeof user !== 'string' || !user || user.length > 64) continue;
    const ids = (days[day] ??= []);
    if (!ids.includes(user)) ids.push(user);
  }
  return days;
}

/** `days` with `userId` on every day of `mine` (this phone's own pings, fresher than the server's copy). */
export function withMyPingDays(days: PingDays, userId: string, mine: Iterable<string>): PingDays {
  const next: PingDays = { ...days };
  for (const day of mine) {
    const ids = next[day] ?? [];
    if (!ids.includes(userId)) next[day] = [...ids, userId];
  }
  return next;
}

/** A calendar cell's faces: the members who pinged, in the group's order (by colour slot). */
export function dayPingers(group: Group, ids: readonly string[] | undefined): GroupMember[] {
  if (!ids?.length) return [];
  return group.members.filter((m) => ids.includes(m.userId));
}

/**
 * Whether `day` ('YYYY-MM-DD') is the group's birthday: the day it was made
 * (`createdAt`, ISO) and the same date every year after.
 */
export function isGroupBirthday(day: string, createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const born = dateKey(new Date(createdAt));
  return day >= born && day.slice(5) === born.slice(5);
}
