import { useCallback, useEffect, useRef, useState } from 'react';
import { groupService } from '../services/groupService';

/** How often the counts are asked for again (live nudges do the rest). */
const REFRESH_MS = 60_000;
/** Live nudges this close together make one read. */
const GATHER_MS = 400;

/**
 * Per group of mine, how many lines of its 대화 I haven't read (the 대화
 * buttons' badges): read while `active` (We Now, signed in), again when the
 * app comes back to the front, every minute, and whenever a line may have
 * come into any group (live). `refresh` reads them again now (a 대화 read).
 */
export function useUnreadTalk(active: boolean): { counts: Record<string, number>; refresh(): void } {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const asked = useRef(0);
  const refresh = useCallback(() => {
    const n = ++asked.current;
    void groupService.unreadTalk().then((next) => {
      if (n === asked.current && next !== 'error') setCounts(next);
    });
  }, []);
  useEffect(() => {
    if (!active) return;
    refresh();
    let nudge: number | undefined;
    const stop = groupService.watchAllTalk(() => {
      window.clearTimeout(nudge);
      nudge = window.setTimeout(refresh, GATHER_MS);
    });
    const timer = window.setInterval(refresh, REFRESH_MS);
    const onShow = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      stop();
      window.clearTimeout(nudge);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [active, refresh]);
  return { counts, refresh };
}
