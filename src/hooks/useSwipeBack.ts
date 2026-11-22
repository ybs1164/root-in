import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { BACK_SWIPE, swipeCommits, swipeHeading } from '../domain/appTabs';
import { slideOff, springBack } from '../lib/swipeSlide';

interface Options {
  /** What follows the finger (default: the element the handlers are on). */
  target?: () => HTMLElement | null;
  /** Let go far or fast enough, from `fromPx` (default: slides the target off, then `onBack`). */
  commit?: (el: HTMLElement, fromPx: number) => void;
}

type Swipe = { x: number; y: number; dx: number; v: number; at: number; el: HTMLElement | null; root: HTMLElement; start: Element; frozen: HTMLElement | null; prevOverflow: string };

/**
 * A full screen that a left-to-right swipe takes back (대화, 갤러리, 그룹 달력,
 * 설정): it follows the finger, and let go far or fast enough it slides off
 * to the right and `onBack` runs — otherwise it springs back. A scroll or a
 * move left isn't a swipe. `enabled` false: nothing (another screen is over
 * it). Spread the returned handlers on the screen's root.
 *
 * Fingers are followed with touch events, not pointer events (2026-11-22):
 * a screen that scrolls up and down hands a touch to the browser's scroll as
 * soon as it leans more up than across, which cancels its pointer — only a
 * swipe within 45° of level ever went back. Touches keep coming, so a swipe
 * that leans up to `BACK_SWIPE.slope` still counts; the list under it is held
 * still meanwhile. A mouse uses the pointer handlers.
 */
export function useSwipeBack(onBack: () => void, enabled = true, options: Options = {}) {
  const swipe = useRef<Swipe | null>(null);
  const going = useRef(false);
  /** A swipe just ended: its click isn't a tap on what's under the finger. */
  const swallow = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const begin = (x: number, y: number, target: EventTarget | null, root: HTMLElement) => {
    swipe.current = null;
    if (!enabled || going.current) return;
    const start = target as Element | null;
    // A press in a field moves its caret, and a strip marked `data-swipe-keep`
    // scrolls sideways itself: neither moves the screen.
    if (!start?.closest || start.closest('input, textarea, [data-swipe-keep]')) return;
    swipe.current = { x, y, dx: 0, v: 0, at: performance.now(), el: null, root, start, frozen: null, prevOverflow: '' };
  };

  const move = (x: number, y: number) => {
    const sw = swipe.current;
    if (!sw) return;
    const [dx, dy] = [x - sw.x, y - sw.y];
    if (!sw.el) {
      const heading = swipeHeading(dx, dy);
      if (heading === null) return;
      if (heading !== 1) return void (swipe.current = null);
      sw.el = optionsRef.current.target?.() ?? sw.root;
      // The list it started on stops scrolling while the screen follows the finger.
      sw.frozen = scrollerOf(sw.start, sw.root);
      if (sw.frozen) {
        sw.prevOverflow = sw.frozen.style.overflowY;
        sw.frozen.style.overflowY = 'hidden';
      }
    }
    const now = performance.now();
    const next = Math.max(0, dx);
    // How fast it's going right, smoothed over the last moves (a slowing finger still flicks).
    const dt = Math.max(1, now - sw.at);
    sw.v = sw.v * 0.4 + ((next - sw.dx) / dt) * 0.6;
    sw.dx = next;
    sw.at = now;
    sw.el.style.translate = `${next}px 0`;
  };

  const end = (cancelled = false) => {
    const sw = swipe.current;
    swipe.current = null;
    if (!sw?.el) return;
    if (sw.frozen) sw.frozen.style.overflowY = sw.prevOverflow;
    swallow.current = true;
    window.setTimeout(() => (swallow.current = false), 0);
    const el = sw.el;
    // A finger resting a moment before letting go isn't a flick.
    const v = performance.now() - sw.at > 80 ? 0 : sw.v;
    if (!cancelled && swipeCommits(1, sw.dx, el.getBoundingClientRect().width || window.innerWidth, v, BACK_SWIPE)) {
      const commit = optionsRef.current.commit;
      if (commit) return commit(el, sw.dx);
      going.current = true;
      return slideOff(el, sw.dx, () => {
        going.current = false;
        onBack();
      });
    }
    springBack(el, sw.dx);
  };

  const onTouchStart = (e: ReactTouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) return end(true);
    begin(e.touches[0].clientX, e.touches[0].clientY, e.target, e.currentTarget);
  };
  const onTouchMove = (e: ReactTouchEvent<HTMLElement>) => {
    if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onTouchEnd = (e: ReactTouchEvent<HTMLElement>) => {
    if (e.touches.length === 0) end();
  };
  const onTouchCancel = () => end(true);

  // A mouse (or pen): the same swipe by dragging.
  const mouseId = useRef<number | null>(null);
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch' || !e.isPrimary || e.button > 0) return;
    mouseId.current = e.pointerId;
    begin(e.clientX, e.clientY, e.target, e.currentTarget);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerId !== mouseId.current) return;
    const had = !!swipe.current?.el;
    move(e.clientX, e.clientY);
    if (!had && swipe.current?.el) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Not a live pointer: moves still come while over the screen.
      }
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerId !== mouseId.current) return;
    mouseId.current = null;
    end(e.type === 'pointercancel');
  };

  const onClickCapture = (e: ReactMouseEvent) => {
    if (!swallow.current) return;
    swallow.current = false;
    e.stopPropagation();
    e.preventDefault();
  };
  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture };
}

/** The nearest element from `start` up to `root` that scrolls up and down (and has somewhere to go). */
function scrollerOf(start: Element, root: HTMLElement): HTMLElement | null {
  for (let el: Element | null = start; el && el !== root.parentElement; el = el.parentElement) {
    if (!(el instanceof HTMLElement) || el.scrollHeight <= el.clientHeight + 1) continue;
    const y = getComputedStyle(el).overflowY;
    if (y === 'auto' || y === 'scroll') return el;
  }
  return null;
}
