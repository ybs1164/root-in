import { useCallback, useEffect, useRef, useState } from 'react';
import type { GalleryPhoto, MetPair } from '../domain/gallery';
import { metPairs } from '../domain/groups';
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

/** How many days the 만난 날 stand-in (a my_groups read a day) reads at most. */
const MET_FALLBACK_DAYS = 62;

/**
 * 만난 날's pairs for the gallery's days, read once the switch is on (`on`)
 * and again when the days or groups change. Without the server's
 * group_met_days, each day's groups are read and the pairs worked out here
 * (the newest days, up to MET_FALLBACK_DAYS).
 */
export function useMetDays(groupIds: readonly string[] | null, days: readonly string[], on: boolean): { status: 'loading' | 'ready' | 'error'; pairs: MetPair[] } {
  const [state, setState] = useState<{ key: string; status: 'loading' | 'ready' | 'error'; pairs: MetPair[] }>({ key: '', status: 'loading', pairs: [] });
  const key = on && groupIds ? `${[...groupIds].sort().join(',')}|${[...days].sort().join(',')}` : '';
  useEffect(() => {
    if (!key || !groupIds) return;
    let live = true;
    void (async () => {
      const asked = await groupService.metDays([...groupIds], [...days]);
      if (asked !== 'error') return live && setState({ key, status: 'ready', pairs: asked });
      const recent = [...days].sort().reverse().slice(0, MET_FALLBACK_DAYS);
      const lists = await Promise.all(recent.map((d) => groupService.list(d)));
      if (!live) return;
      const pairs: MetPair[] = [];
      lists.forEach((list, i) => {
        if (list === 'error') return;
        for (const g of list) if (groupIds.includes(g.id)) for (const users of metPairs(g.members)) pairs.push({ groupId: g.id, day: recent[i], users });
      });
      const failed = lists.length > 0 && lists.every((l) => l === 'error');
      setState({ key, status: failed ? 'error' : 'ready', pairs });
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? state : { status: 'loading', pairs: [] };
}
