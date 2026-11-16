import { useEffect, type RefObject } from 'react';
import { lookTargetAt } from '../components/GroupLookLayer';
import type { GroupPlace } from '../components/GroupMapView';
import { PRESS } from '../domain/dayPings';

/**
 * On a group's map, a quick tap (not a pan or a long press) on someone's
 * ping, photo or face (faded or not) puts the focus on them and opens that
 * place's photo panel; on bare map it goes back to ALL (panel and all).
 * The pings let taps through to the atlas under them, so they're found by where they are on screen.
 * `mine` is my own row (my id and how many pings): a tap on one of my pings or lines is its shape picker's.
 */
export function useGroupMapTaps(
  on: boolean,
  atlasEl: RefObject<HTMLElement | null>,
  mine: { readonly current: { me: string; count: number } | null },
  onPick: (member: string | null) => void,
  onPlace: (place: GroupPlace | null) => void,
): void {
  useEffect(() => {
    const el = atlasEl.current;
    if (!on || !el) return;
    let tap: { x: number; y: number; at: number } | null = null;
    const hit = (x: number, y: number): GroupPlace | null => {
      let found: GroupPlace | null = null;
      for (const p of document.querySelectorAll<HTMLElement>('.group-ping')) {
        if (!p.dataset.member) continue;
        const parts = [...p.querySelectorAll<HTMLElement>('.group-ping__photo, .group-ping__face, .group-ping__pin')].filter((c) => getComputedStyle(c).visibility !== 'hidden');
        const within = (c: HTMLElement) => {
          const r = c.getBoundingClientRect();
          return x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6;
        };
        if (!parts.some(within)) continue;
        // One of a place's stacked photos: that photo, not just the newest.
        const photo = parts.find((c) => c.dataset.photo !== undefined && within(c));
        // On a shared place a photo or face says whose it is; its pin is the place's first ping.
        const whose = photo?.dataset.member ? photo : parts.find((c) => c.dataset.member && within(c));
        const member = whose?.dataset.member ?? p.dataset.member;
        const seq = Number(whose?.dataset.seq ?? p.dataset.seq);
        found = { member, seq, ...(photo ? { photo: Number(photo.dataset.photo) } : {}) };
        // A photo or a face is over the pins around it.
        if (p.classList.contains('has-photo') || p.classList.contains('group-ping--face') || p.classList.contains('has-faces')) break;
      }
      return found;
    };
    const down = (e: PointerEvent) => {
      // A touch that only closes the ping / line picker isn't a tap on the map.
      // Nor is a doodle on the day's board.
      tap = e.isPrimary && el.contains(e.target as Node) && !document.querySelector('.group-look-picker, .group-board.is-drawing') ? { x: e.clientX, y: e.clientY, at: performance.now() } : null;
    };
    const up = (e: PointerEvent) => {
      const t = tap;
      tap = null;
      if (!t || !e.isPrimary || !el.contains(e.target as Node)) return;
      if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > PRESS.slopPx || performance.now() - t.at >= PRESS.longMs) return;
      // One of my own pings or lines: that tap opens its shape picker (GroupLookLayer) instead.
      const me = mine.current;
      if (me && lookTargetAt(e.clientX, e.clientY, me.me, me.count)) return;
      const at = hit(e.clientX, e.clientY);
      if (at) {
        onPick(at.member);
        onPlace(at);
      } else {
        // Bare map: back to ALL, with the photo panel too if it's open.
        onPlace(null);
        onPick(null);
      }
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
    };
    // `onPick` and `onPlace` are state setters (stable); `mine` is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
}
