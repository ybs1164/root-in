import { useCallback, useEffect, useRef, useState } from 'react';
import type { GalleryPhoto } from '../domain/gallery';
import { groupService } from '../services/groupService';

export type GalleryState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; photos: GalleryPhoto[] };

/**
 * The photos sent to `groupIds`, read while a gallery is open (null = closed).
 * Read afresh every time it opens; only the latest read lands.
 */
export function useGalleryPhotos(groupIds: readonly string[] | null): { state: GalleryState; retry(): void } {
  const [state, setState] = useState<GalleryState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const turn = useRef(0);
  const key = groupIds ? [...groupIds].sort().join(',') : null;
  useEffect(() => {
    if (key === null) return;
    const mine = ++turn.current;
    setState({ status: 'loading' });
    void groupService.photos(key ? key.split(',') : []).then((photos) => {
      if (mine !== turn.current) return;
      setState(photos === 'error' ? { status: 'error' } : { status: 'ready', photos });
    });
  }, [key, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
