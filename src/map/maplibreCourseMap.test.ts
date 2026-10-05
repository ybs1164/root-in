import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapLibreCourseMap } from './maplibreCourseMap';

// Exercise fitting without a WebGL canvas; the map decides when movement ends.
function fittingMap(animated = true) {
  const handlers = new Set<() => void>();
  let moving = false;
  const end = () => {
    moving = false;
    for (const handler of [...handlers]) handler();
  };
  const map = {
    fitBounds: vi.fn(() => {
      end(); // Starting a new move ends the previous one synchronously.
      moving = animated;
    }),
    isMoving: () => moving,
    on: (_event: string, handler: () => void) => handlers.add(handler),
    off: (_event: string, handler: () => void) => handlers.delete(handler),
  };
  const adapter = Object.assign(Object.create(MapLibreCourseMap.prototype), { map, ready: true }) as MapLibreCourseMap;
  return {
    fit: () => adapter.fitPoints([[126.978, 37.5665], [127.058, 37.544]], { top: 100, bottom: 100, left: 80, right: 80 }, 260),
    end,
    handlers,
  };
}

afterEach(() => vi.useRealTimers());

describe('route fit completion', () => {
  it('waits for the actual movement end, even past the expected duration', async () => {
    vi.useFakeTimers();
    const map = fittingMap();
    const complete = vi.fn();
    const settled = map.fit().then(complete);
    await vi.advanceTimersByTimeAsync(1000);
    expect(complete).not.toHaveBeenCalled();
    map.end();
    await settled;
    expect(complete).toHaveBeenCalledOnce();
    expect(map.handlers.size).toBe(0);
  });

  it('does not count the previous move ending when a new fit starts', async () => {
    const map = fittingMap();
    const previous = map.fit();
    const complete = vi.fn();
    const settled = map.fit().then(complete);
    await previous;
    await Promise.resolve();
    expect(complete).not.toHaveBeenCalled();
    map.end();
    await settled;
    expect(complete).toHaveBeenCalledOnce();
  });

  it('resolves an immediate fit without waiting for a future event', async () => {
    const map = fittingMap(false);
    await map.fit();
    expect(map.handlers.size).toBe(0);
  });
});
