import type { StoredPing } from './dayPings';

/** A photo sent to a group from the camera, as the gallery lists it. */
export interface GalleryPhoto {
  /** The row's id (one per group it was sent to). */
  id: string;
  groupId: string;
  /** Who sent it. */
  userId: string;
  /** The day screen it belongs to (the sender's local date, YYYY-MM-DD). */
  day: string;
  at: string;
  /** Where it was taken (the place picked to send it as). */
  name: string;
  /** Its address in the bucket; the same upload sent to several groups shares it (`ping:<id>` for TODAY's own). */
  path: string;
  url: string;
}

/** One photo upload, with every group it went to (TODAY's gallery shows it once). */
export interface GalleryItem extends GalleryPhoto {
  /** Empty for a TODAY photo that never left the phone. */
  groupIds: string[];
}

export interface GalleryDay {
  day: string;
  photos: GalleryItem[];
}

const newestFirst = (a: { at: string }, b: { at: string }) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);

/**
 * The gallery's days, newest first, each with its photos newest first. A
 * photo sent to several groups is one upload (one `path`): it's listed once,
 * with all of those groups.
 */
export function galleryDays(photos: readonly GalleryPhoto[]): GalleryDay[] {
  const byPath = new Map<string, GalleryItem>();
  for (const p of photos) {
    const known = byPath.get(p.path);
    if (known) {
      if (!known.groupIds.includes(p.groupId)) known.groupIds.push(p.groupId);
    } else byPath.set(p.path, { ...p, groupIds: p.groupId ? [p.groupId] : [] });
  }
  const days = new Map<string, GalleryItem[]>();
  for (const item of byPath.values()) {
    const list = days.get(item.day);
    if (list) list.push(item);
    else days.set(item.day, [item]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, list]) => ({ day, photos: list.sort(newestFirst) }));
}

/** A day's heading: TODAY, else `10.27` (with the year when it isn't this one's). */
export function galleryDayLabel(day: string, today: string): string {
  if (day === today) return 'TODAY';
  const [y, m, d] = day.split('-').map(Number);
  const date = `${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
  return y === Number(today.slice(0, 4)) ? date : `${y}.${date}`;
}

/** Who put photos up on a day, each once, the first to post first. */
export function dayPosters(photos: readonly GalleryItem[]): string[] {
  return [...new Set([...photos].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)).map((p) => p.userId))];
}

/** A gallery tab: MY (my own photos) or one group's. */
export type GalleryTab = 'my' | string;

/** TODAY's photos kept on this phone (one per ping), as gallery photos of mine with no group. */
export function localGalleryPhotos(pings: readonly StoredPing[], photos: Readonly<Record<string, string>>, me: string): GalleryPhoto[] {
  return pings
    .filter((p) => photos[p.id])
    .map((p) => ({ id: `ping:${p.id}`, groupId: '', userId: me, day: p.day, at: p.at, name: p.name, path: `ping:${p.id}`, url: photos[p.id] }));
}

/**
 * A tab's photos, by day: MY is every photo I sent (to any group, each
 * once) plus TODAY's on this phone; a group's tab is every photo sent there.
 */
export function galleryTabDays(tab: GalleryTab, photos: readonly GalleryPhoto[], me: string | null, local: readonly GalleryPhoto[]): GalleryDay[] {
  if (tab === 'my') return galleryDays([...photos.filter((p) => !!me && p.userId === me), ...local]);
  return galleryDays(photos.filter((p) => p.groupId === tab));
}

/**
 * The big viewer's order: oldest first, so the newest is the last (furthest
 * right) and paging back goes on through the days before.
 */
export const viewerOrder = (days: readonly GalleryDay[]): GalleryItem[] => days.flatMap((d) => d.photos).reverse();

/** Two members of a group who pinged (or sent a photo from) the same place on a day: they met. */
export interface MetPair {
  groupId: string;
  day: string;
  users: [string, string];
}

/**
 * The days 만난 날 keeps: in a group's tab, every day two of its members met;
 * in MY, every day I met someone, in any of my groups.
 */
export function metDays(pairs: readonly MetPair[], tab: GalleryTab, me: string | null): Set<string> {
  const days = new Set<string>();
  for (const p of pairs) {
    if (tab === 'my' ? !!me && p.users.includes(me) : p.groupId === tab) days.add(p.day);
  }
  return days;
}

/** What the gallery shows with its switches on: 즐겨찾기 only starred photos, 만난 날 every photo of a day that was one (both: both). */
export function filterGallery(days: readonly GalleryDay[], filter: { stars?: ReadonlySet<string>; met?: ReadonlySet<string> }): GalleryDay[] {
  return days
    .filter((d) => !filter.met || filter.met.has(d.day))
    .map((d) => (filter.stars ? { ...d, photos: d.photos.filter((p) => filter.stars!.has(p.path)) } : d))
    .filter((d) => d.photos.length > 0);
}
