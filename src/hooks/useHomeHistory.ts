import { useEffect, useRef } from 'react';

/**
 * We Now's list is home. Being `away` from it (the map, or a group or TODAY
 * open on We Now) pushes a history entry so the browser's back comes home
 * first; leaving some other way takes that entry back off, so back at home
 * leaves the app.
 *
 * On back: `inner` gets the first say — true when it closed a layer of its
 * own (a photo open big), and the entry is put back in place; otherwise
 * `home` takes the screen back to the list.
 */
export function useHomeHistory(away: boolean, tab: string, on: { inner: () => boolean; home: () => void }): void {
  const entry = useRef(false);
  useEffect(() => {
    if (away && !entry.current) {
      entry.current = true;
      history.pushState({ rootIn: tab }, '');
    } else if (!away && entry.current) {
      entry.current = false;
      history.back();
    }
  }, [away, tab]);
  const latest = useRef({ tab, on });
  latest.current = { tab, on };
  useEffect(() => {
    const pop = () => {
      if (!entry.current) return;
      const now = latest.current;
      if (now.on.inner()) {
        history.pushState({ rootIn: now.tab }, '');
        return;
      }
      entry.current = false;
      now.on.home();
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
}
