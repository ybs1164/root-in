import { useEffect, useState } from 'react';
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

/**
 * The big photo's ★ and ♥, the same wherever it opens (the gallery, a
 * group's map, TODAY): stars kept on this phone, hearts on the server
 * (telling the sender). `withHearts` false skips reading the hearts (TODAY:
 * only my own photos there).
 */
export function usePhotoMarks(withHearts = true): PhotoMarks {
  const [stars, setStars] = useState(() => new Set(loadGalleryStars()));
  const toggleStar = (path: string) =>
    setStars((now) => {
      const next = new Set(now);
      if (!next.delete(path)) next.add(path);
      saveGalleryStars([...next]);
      return next;
    });
  // Hearts: on other people's photos, telling the sender (no count shown anywhere).
  const [hearts, setHearts] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!withHearts) return;
    let live = true;
    void groupService.hearted().then((paths) => live && paths !== 'error' && setHearts(new Set(paths)));
    return () => {
      live = false;
    };
  }, [withHearts]);
  const toggleHeart = (path: string) => {
    const on = !hearts.has(path);
    const flip = (want: boolean) =>
      setHearts((now) => {
        const next = new Set(now);
        if (want) next.add(path);
        else next.delete(path);
        return next;
      });
    flip(on);
    // Didn't go through: back as it was.
    void groupService.heart(path, on).then((ok) => ok || flip(!on));
  };
  return { stars, toggleStar, hearts, toggleHeart };
}
