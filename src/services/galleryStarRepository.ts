const STARS_KEY = 'goodroot:gallery-stars:v1';
/** More than a gallery ever shows (GALLERY_LIMIT and TODAY's photos), so none fall off in use. */
const MAX_STARS = 2000;

/**
 * The gallery's 즐겨찾기: the photos I starred, by their `path` (one upload,
 * however many groups it went to). Only mine and only on this phone — never
 * synced, never shown to anyone else.
 */
export function loadGalleryStars(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STARS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.filter((p): p is string => typeof p === 'string' && p.length > 0 && p.length <= 120))].slice(-MAX_STARS);
  } catch {
    return [];
  }
}

export function saveGalleryStars(paths: readonly string[]): void {
  try {
    window.localStorage.setItem(STARS_KEY, JSON.stringify([...new Set(paths)].slice(-MAX_STARS)));
  } catch {
    // Full or blocked storage: the star lasts until the app closes.
  }
}
