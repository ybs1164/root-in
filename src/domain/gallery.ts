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
  /** Its address in the bucket; the same upload sent to several groups shares it. */
  path: string;
  url: string;
}

/** One photo upload, with every group it went to (TODAY's gallery shows it once). */
export interface GalleryItem extends GalleryPhoto {
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
    } else byPath.set(p.path, { ...p, groupIds: [p.groupId] });
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

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** A day's heading: TODAY, else `10.27 화` (with the year when it isn't this one's). */
export function galleryDayLabel(day: string, today: string): string {
  if (day === today) return 'TODAY';
  const [y, m, d] = day.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const date = `${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
  return `${y === Number(today.slice(0, 4)) ? date : `${y}.${date}`} ${weekday}`;
}
