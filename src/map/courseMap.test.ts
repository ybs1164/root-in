import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachLongPress } from './courseMap';

// A stand-in for the map container: only what attachLongPress touches.
function fakeContainer() {
  const handlers = new Map<string, (event: unknown) => void>();
  return {
    addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler),
    removeEventListener: (type: string) => handlers.delete(type),
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
    fire: (type: string, event: unknown) => handlers.get(type)?.(event),
    handlers,
  };
}

const touch = (x: number, y: number, count = 1) => ({
  touches: Array.from({ length: count }, () => ({ clientX: x, clientY: y })),
});

describe('map long-press', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('long-press on the map starts a pin at that point (also closes M1 1.3)', () => {
    const el = fakeContainer();
    const onPress = vi.fn();
    const detach = attachLongPress(el as unknown as HTMLElement, onPress);

    el.fire('touchstart', touch(110, 220));
    vi.advanceTimersByTime(600);
    expect(onPress).toHaveBeenCalledWith(100, 200);

    // The contextmenu a touch browser fires after a long-press is ignored…
    el.fire('contextmenu', { clientX: 110, clientY: 220, preventDefault: () => {} });
    expect(onPress).toHaveBeenCalledTimes(1);

    // …and so is a right-click / two-finger click: it no longer starts a pin.
    vi.advanceTimersByTime(2000);
    el.fire('contextmenu', { clientX: 60, clientY: 70, preventDefault: () => {} });
    expect(onPress).toHaveBeenCalledTimes(1);

    detach();
    expect(el.handlers.size).toBe(0);
  });

  it('a drag or a pinch is not a long-press', () => {
    const el = fakeContainer();
    const onPress = vi.fn();
    attachLongPress(el as unknown as HTMLElement, onPress);

    el.fire('touchstart', touch(100, 100));
    el.fire('touchmove', touch(130, 100));
    vi.advanceTimersByTime(600);

    el.fire('touchstart', touch(100, 100, 2));
    vi.advanceTimersByTime(600);

    el.fire('touchstart', touch(100, 100));
    el.fire('touchend', {});
    vi.advanceTimersByTime(600);

    expect(onPress).not.toHaveBeenCalled();
  });
});
