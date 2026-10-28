/**
 * Photos taken on TODAY, one per ping (the latest taken there), as small
 * square JPEG data URLs. Kept on this phone only: they're never synced or put
 * in a link, so a photo of where you are doesn't leave the phone.
 */
const PHOTOS_KEY = 'goodroot:ping-photos:v1';

/** Oldest go first past this, so the photos can't fill up localStorage. */
export const MAX_PING_PHOTOS = 120;
/** A ping's photo: a square this many px across, small enough to keep a hundred in localStorage. */
export const PING_PHOTO_PX = 240;

const isPhoto = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('data:image/jpeg;base64,') && value.length < 200_000;

/** Ping id → photo, oldest first. */
export function loadPingPhotos(): Record<string, string> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PHOTOS_KEY) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).filter(([id, photo]) => id.length <= 64 && isPhoto(photo)));
  } catch {
    return {};
  }
}

const listeners = new Set<() => void>();

export function onPingPhotosChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Puts a photo on a ping (replacing one it had). Photos of pings that are
 * gone (taken out of their day, or their pin deleted) are dropped on the way.
 */
export function savePingPhoto(pingId: string, photo: string, alive: ReadonlySet<string>): void {
  if (!isPhoto(photo)) return;
  const kept = Object.entries(loadPingPhotos()).filter(([id]) => id !== pingId && alive.has(id));
  const next = Object.fromEntries([...kept, [pingId, photo]].slice(-MAX_PING_PHOTOS));
  try {
    window.localStorage.setItem(PHOTOS_KEY, JSON.stringify(next));
  } catch {
    // Storage full: the ping is saved, only its photo is lost.
    return;
  }
  listeners.forEach((listener) => listener());
}
