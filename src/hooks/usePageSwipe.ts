import { useRef, useState, type CSSProperties, type TouchEvent } from 'react';
import { SWIPE, swipeCommits } from '../domain/appTabs';

interface Track {
  x: number;
  y: number;
  lastX: number;
  /** The previous move sample, for the release velocity. */
  prevX: number;
  prevT: number;
  lastT: number;
  /** Decided once the finger has moved: a sideways swipe one way (-1 left, 1 right), or anything else. */
  axis: -1 | 1 | 'other' | null;
}

const LEAVE_MS = 260;

/**
 * One-finger sideways swipe that pushes a tab page off to the left
 * (`onLeft`, a right-to-left swipe) or the right (`onRight`); either can be
 * left out, and that way only resists. The page follows the finger; on
 * release it either slides the rest of the way and calls the handler, or
 * springs back. A second finger (the calendar's pinch) or a mostly vertical
 * move is left alone.
 */
export function usePageSwipe(onLeft: (() => void) | null, onRight: (() => void) | null) {
  const track = useRef<Track | null>(null);
  const [dx, setDx] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'drag' | 'leaving' | 'back'>('idle');
  // Which way the page is going (or went): the bottom row turns toward its screen meanwhile.
  const [heading, setHeading] = useState<-1 | 1 | null>(null);
  const width = () => window.innerWidth;
  const handler = (dir: -1 | 1) => (dir < 0 ? onLeft : onRight);

  const settle = useRef<number | undefined>(undefined);

  const reset = () => {
    track.current = null;
    setPhase('back');
    setDx(0);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      setPhase((p) => (p === 'back' ? 'idle' : p));
      setHeading(null);
    }, LEAVE_MS);
  };

  const go = (dir: -1 | 1) => {
    const then = handler(dir);
    if (!then) return reset();
    setHeading(dir);
    setPhase('leaving');
    setDx(dir * width());
    window.setTimeout(() => {
      then();
      setPhase('idle');
      setDx(0);
      setHeading(null);
    }, LEAVE_MS);
  };

  const onTouchStart = (e: TouchEvent) => {
    if ((!onLeft && !onRight) || phase === 'leaving') return;
    if (e.touches.length !== 1) {
      if (typeof track.current?.axis === 'number') reset();
      track.current = null;
      return;
    }
    const { clientX: x, clientY: y } = e.touches[0];
    const t = performance.now();
    track.current = { x, y, lastX: x, lastT: t, prevX: x, prevT: t, axis: null };
  };

  const onTouchMove = (e: TouchEvent) => {
    const tr = track.current;
    if (!tr || e.touches.length !== 1) return;
    const { clientX: x, clientY: y } = e.touches[0];
    const mx = x - tr.x;
    if (tr.axis === null) {
      if (Math.abs(mx) < SWIPE.startPx && Math.abs(y - tr.y) < SWIPE.startPx) return;
      // Only a mostly-sideways move toward a side that leads somewhere becomes a swipe.
      const dir = mx < 0 ? -1 : 1;
      tr.axis = Math.abs(mx) > Math.abs(y - tr.y) && handler(dir) ? dir : 'other';
      if (tr.axis !== 'other') {
        setPhase('drag');
        setHeading(dir);
      }
    }
    if (tr.axis === 'other') return;
    tr.prevX = tr.lastX;
    tr.prevT = tr.lastT;
    tr.lastX = x;
    tr.lastT = performance.now();
    // Pulling back past the start just resists at the edge.
    setDx(mx * tr.axis > 0 ? mx : mx * 0.15);
  };

  const onTouchEnd = (e: TouchEvent) => {
    const tr = track.current;
    if (!tr || e.touches.length > 0) return;
    track.current = null;
    if (tr.axis === null || tr.axis === 'other') return;
    const moved = tr.lastX - tr.x;
    const velocity = (tr.lastX - tr.prevX) / Math.max(1, tr.lastT - tr.prevT);
    if (swipeCommits(tr.axis, moved, width(), velocity)) go(tr.axis);
    else reset();
  };

  /** The same slide off toward `dir`, without a finger (the phone's back button). */
  const leave = (dir: -1 | 1) => {
    if (phase === 'leaving') return;
    track.current = null;
    go(dir);
  };

  const style: CSSProperties =
    phase === 'idle'
      ? {}
      : {
          transform: `translateX(${dx}px)`,
          transition: phase === 'drag' ? 'none' : `transform ${LEAVE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
        };

  return {
    /** True from release until the page is gone. */
    leaving: phase === 'leaving',
    /** Off its resting place: dragged, leaving, or springing back. */
    moving: phase !== 'idle',
    /** The side the page is being pushed to while it moves (-1 left, 1 right). */
    heading,
    style,
    leave,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset },
  };
}
