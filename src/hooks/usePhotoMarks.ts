import { useEffect, useSyncExternalStore } from 'react';
import { groupService } from '../services/groupService';
import { loadGalleryStars, saveGalleryStars } from '../services/galleryStarRepository';

export interface PhotoMarks {
  /** 즐겨찾기: the photos I starred (by path) — mine alone, on this phone. */
  stars: Set<string>;
  toggleStar(path: string): void;
  /** The photos I hearted (by path); null when hearts aren't read here. */
  hearts: Set<string>;
  toggleHeart(path: string): void;
}

// One copy for the whole app: the same photo's ★ ♥ show in more than one
// place at once (the group map's photo panel stays mounted under the big
// photo), and a mark made in one must show in the others when it closes.
let stars: Set<string> | null = null;
let hearts = new Set<string>();
// Bumped by every heart tap: a read that started before one is stale.
let heartTaps = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getStars = () => (stars ??= new Set(loadGalleryStars()));
const getHearts = () => hearts;

function toggleStar(path: string) {
  const next = new Set(getStars());
  if (!next.delete(path)) next.add(path);
  saveGalleryStars([...next]);
  stars = next;
  notify();
}

function setHeart(path: string, on: boolean) {
  if (hearts.has(path) === on) return;
  const next = new Set(hearts);
  if (on) next.add(path);
  else next.delete(path);
  hearts = next;
  notify();
}

function toggleHeart(path: string) {
  const on = !hearts.has(path);
  heartTaps++;
  setHeart(path, on);
  // Didn't go through: back as it was.
  void groupService.heart(path, on).then((ok) => ok || setHeart(path, !on));
}

/**
 * The big photo's ★ and ♥, the same wherever it opens (the gallery, a
 * group's map, TODAY): stars kept on this phone, hearts on the server
 * (telling the sender). `withHearts` false skips reading the hearts (TODAY:
 * only my own photos there).
 */
export function usePhotoMarks(withHearts = true): PhotoMarks {
  const shownStars = useSyncExternalStore(subscribe, getStars);
  const shownHearts = useSyncExternalStore(subscribe, getHearts);
  useEffect(() => {
    if (!withHearts) return;
    let live = true;
    const taps = heartTaps;
    void groupService.hearted().then((paths) => {
      if (!live || paths === 'error' || taps !== heartTaps) return;
      hearts = new Set(paths);
      notify();
    });
    return () => {
      live = false;
    };
  }, [withHearts]);
  return { stars: shownStars, toggleStar, hearts: shownHearts, toggleHeart };
}
