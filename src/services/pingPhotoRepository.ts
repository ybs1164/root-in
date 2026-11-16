/**
 * Photos taken on TODAY, stacked on their ping (every shot taken there, oldest
 * first), as small square JPEG data URLs. Kept on this phone only: they're
 * never synced or put in a link, so a photo of where you are doesn't leave the
 * phone.
 */
const PHOTOS_KEY = 'goodroot:ping-photos:v2';
/** v1 kept one photo per ping (ping id → data URL); read once into v2. */
const OLD_KEY = 'goodroot:ping-photos:v1';

/** Oldest go first past this (counting every photo), so they can't fill up localStorage. */
export const MAX_PING_PHOTOS = 120;
/** A ping's photo: a square this many px across, small enough to keep a hundred in localStorage. */
export const PING_PHOTO_PX = 240;

/** One photo on a ping. */
export interface PingPhoto {
  /**
   * Its own id, the key of its ★ and comments (`ping:<id>`). A v1 photo keeps
   * its ping's id, so what was starred or said on it stays with it.
   */
  id: string;
  src: string;
  /** When it was taken (ISO); none on a v1 photo (its ping's time). */
  at?: string;
}

/** Ping id → its photos, oldest first. */
export type PingPhotos = Record<string, PingPhoto[]>;

const isPhoto = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('data:image/jpeg;base64,') && value.length < 200_000;

const readEntry = (raw: unknown): PingPhoto | null => {
  if (!raw || typeof raw !== 'object') return null;
  const { id, src, at } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || !id || id.length > 80 || !isPhoto(src)) return null;
  return typeof at === 'string' && at.length <= 40 ? { id, src, at } : { id, src };
};

function readStore(): PingPhotos {
  const stored = window.localStorage.getItem(PHOTOS_KEY);
  if (stored !== null) {
    const raw = JSON.parse(stored) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw)
        .filter(([id, list]) => id.length <= 64 && Array.isArray(list))
        .map(([id, list]) => [id, (list as unknown[]).map(readEntry).filter((p): p is PingPhoto => p !== null)] as const)
        .filter(([, list]) => list.length > 0),
    );
  }
  const old = JSON.parse(window.localStorage.getItem(OLD_KEY) ?? '{}') as unknown;
  if (!old || typeof old !== 'object' || Array.isArray(old)) return {};
  return Object.fromEntries(
    Object.entries(old)
      .filter(([id, photo]) => id.length <= 64 && isPhoto(photo))
      .map(([id, photo]) => [id, [{ id, src: photo as string }]]),
  );
}

export function loadPingPhotos(): PingPhotos {
  try {
    return readStore();
  } catch {
    return {};
  }
}

const listeners = new Set<() => void>();

export function onPingPhotosChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function write(photos: PingPhotos): boolean {
  // The oldest photos go first past the limit (the ping just shot is last).
  let extra = Object.values(photos).reduce((n, list) => n + list.length, 0) - MAX_PING_PHOTOS;
  const kept: [string, PingPhoto[]][] = [];
  for (const [id, list] of Object.entries(photos)) {
    const drop = Math.min(Math.max(extra, 0), list.length);
    extra -= drop;
    if (list.length > drop) kept.push([id, list.slice(drop)]);
  }
  try {
    window.localStorage.setItem(PHOTOS_KEY, JSON.stringify(Object.fromEntries(kept)));
    window.localStorage.removeItem(OLD_KEY);
  } catch {
    // Storage full: the ping is saved, only its photo is lost.
    return false;
  }
  listeners.forEach((listener) => listener());
  return true;
}

/**
 * Stacks a photo on a ping (on top of those it has). Photos of pings that
 * are gone (taken out of their day, or their pin deleted) are dropped on the way.
 */
export function savePingPhoto(pingId: string, photo: string, alive: ReadonlySet<string>, at: Date = new Date()): void {
  if (!isPhoto(photo)) return;
  const all = loadPingPhotos();
  const had = all[pingId] ?? [];
  const kept = Object.entries(all).filter(([id]) => id !== pingId && alive.has(id));
  // The ping's id plus when: unique enough on one phone, and short.
  const id = had.length ? `${pingId}~${at.getTime().toString(36)}` : pingId;
  const taken = had.some((p) => p.id === id) ? `${id}${had.length}` : id;
  write(Object.fromEntries([...kept, [pingId, [...had, { id: taken, src: photo, at: at.toISOString() }]]]));
}

/** Takes one photo off its ping's stack (the ping itself stays). */
export function deletePingPhoto(photoId: string): void {
  const all = loadPingPhotos();
  const next = Object.fromEntries(
    Object.entries(all)
      .map(([id, list]) => [id, list.filter((p) => p.id !== photoId)] as const)
      .filter(([, list]) => list.length > 0),
  );
  write(next);
}
