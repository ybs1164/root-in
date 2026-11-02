import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { SWIPE, swipeCommits } from '../domain/appTabs';

const SLIDE_OFF_MS = 240;
const SPRING_BACK_MS = 180;
const stillMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const slideEase = () => getComputedStyle(document.documentElement).getPropertyValue('--slide-ease').trim() || 'ease-out';

/**
 * A full screen that a left-to-right swipe takes back (as Settings): it
 * follows the finger, and let go far or fast enough it slides off to the
 * right and `onBack` runs — otherwise it springs back. A scroll (mostly
 * up and down) or a move left isn't a swipe. `enabled` false: nothing
 * (another screen is over it). Spread `handlers` on the screen's root.
 */
export function useSwipeBack(onBack: () => void, enabled = true) {
  const swipe = useRef<{ id: number; x: number; y: number; dx: number; v: number; at: number; el: HTMLElement | null } | null>(null);
  const going = useRef(false);
  /** A swipe just ended: its click isn't a tap on what's under the finger. */
  const swallow = useRef(false);
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || !e.isPrimary || going.current) return;
    // A press in a field moves its caret, not the screen.
    if ((e.target as Element).closest('input, textarea')) return;
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, v: 0, at: performance.now(), el: null };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const sw = swipe.current;
    if (!sw || sw.id !== e.pointerId) return;
    const [dx, dy] = [e.clientX - sw.x, e.clientY - sw.y];
    if (!sw.el) {
      if (Math.abs(dy) > SWIPE.startPx && Math.abs(dy) >= Math.abs(dx)) return void (swipe.current = null);
      if (dx < SWIPE.startPx || Math.abs(dx) < Math.abs(dy)) return;
      sw.el = e.currentTarget;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Not a live pointer: moves still come while over the screen.
      }
    }
    const now = performance.now();
    const next = Math.max(0, dx);
    sw.v = (next - sw.dx) / Math.max(1, now - sw.at);
    sw.dx = next;
    sw.at = now;
    sw.el.style.translate = `${next}px 0`;
  };
  const onPointerUp = () => {
    const sw = swipe.current;
    swipe.current = null;
    if (!sw?.el) return;
    swallow.current = true;
    window.setTimeout(() => (swallow.current = false), 0);
    const el = sw.el;
    el.style.translate = '';
    if (swipeCommits(1, sw.dx, el.getBoundingClientRect().width || window.innerWidth, sw.v)) {
      going.current = true;
      const done = () => {
        going.current = false;
        onBack();
      };
      el.animate([{ translate: `${sw.dx}px 0` }, { translate: '100% 0' }], { duration: stillMotion() ? 0 : SLIDE_OFF_MS, easing: slideEase(), fill: 'forwards' }).finished.then(done, done);
      return;
    }
    el.animate([{ translate: `${sw.dx}px 0` }, { translate: '0px 0' }], { duration: stillMotion() ? 0 : SPRING_BACK_MS, easing: slideEase() });
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (!swallow.current) return;
    swallow.current = false;
    e.stopPropagation();
    e.preventDefault();
  };
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture };
}
