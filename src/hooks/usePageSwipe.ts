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
  /** Decided once the finger has moved: a horizontal swipe, or anything else. */
  axis: 'x' | 'other' | null;
}

const LEAVE_MS = 260;

/**
 * One-finger horizontal swipe that pushes a tab page off toward `dir`
 * (-1 left, 1 right). The page follows the finger; on release it either
 * slides the rest of the way and calls `onLeave`, or springs back.
 * A second finger (the calendar's pinch) or a mostly vertical move is
 * left alone.
 */
export function usePageSwipe(dir: -1 | 0 | 1, onLeave: () => void) {
  const track = useRef<Track | null>(null);
  const [dx, setDx] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'drag' | 'leaving' | 'back'>('idle');
  const width = () => window.innerWidth;

  const settle = useRef<number | undefined>(undefined);

  const reset = () => {
    track.current = null;
    setPhase('back');
    setDx(0);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => setPhase((p) => (p === 'back' ? 'idle' : p)), LEAVE_MS);
  };

  const onTouchStart = (e: TouchEvent) => {
    if (!dir || phase === 'leaving') return;
    if (e.touches.length !== 1) {
      if (track.current?.axis === 'x') reset();
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
      // Only a mostly-sideways move toward the page's exit side becomes a swipe.
      tr.axis = Math.abs(mx) > Math.abs(y - tr.y) && mx * dir > 0 ? 'x' : 'other';
      if (tr.axis === 'x') setPhase('drag');
    }
    if (tr.axis !== 'x') return;
    tr.prevX = tr.lastX;
    tr.prevT = tr.lastT;
    tr.lastX = x;
    tr.lastT = performance.now();
    // Pulling the wrong way just resists at the edge.
    setDx(mx * dir > 0 ? mx : mx * 0.15);
  };

  const onTouchEnd = (e: TouchEvent) => {
    const tr = track.current;
    if (!tr || e.touches.length > 0) return;
    track.current = null;
    if (tr.axis !== 'x') return;
    const moved = tr.lastX - tr.x;
    const velocity = (tr.lastX - tr.prevX) / Math.max(1, tr.lastT - tr.prevT);
    if (dir && swipeCommits(dir, moved, width(), velocity)) {
      setPhase('leaving');
      setDx(dir * width());
      window.setTimeout(() => {
        onLeave();
        setPhase('idle');
        setDx(0);
      }, LEAVE_MS);
    } else {
      reset();
    }
  };

  const style: CSSProperties =
    phase === 'idle'
      ? {}
      : {
          transform: `translateX(${dx}px)`,
          transition: phase === 'drag' ? 'none' : `transform ${LEAVE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
        };

  return {
    /** True from release until the page is gone: the bottom bar can move to 핀 already. */
    leaving: phase === 'leaving',
    style,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset },
  };
}
