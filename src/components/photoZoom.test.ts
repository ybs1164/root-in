import { describe, expect, it } from 'vitest';
import { clampZoom, NO_ZOOM, pinchZoom, PHOTO_ZOOM } from './PhotoViewer';

describe('big photo pinch zoom', () => {
  const box = { left: 10, top: 100 };

  it('keeps the spot between the fingers under them as it scales', () => {
    const mid = { x: 110, y: 200 };
    const z = pinchZoom({ zoom: NO_ZOOM, mid, spread: 100 }, mid, 200, box);
    expect(z.s).toBe(2);
    // The photo's point (100, 100) is still at the fingers' middle.
    expect(box.left + z.x + 100 * z.s).toBe(mid.x);
    expect(box.top + z.y + 100 * z.s).toBe(mid.y);
  });

  it('follows the fingers as they move together, and stops between 1× and the max', () => {
    const z = pinchZoom({ zoom: NO_ZOOM, mid: { x: 110, y: 200 }, spread: 100 }, { x: 130, y: 210 }, 100, box);
    expect(z).toEqual({ s: 1, x: 20, y: 10 });
    expect(pinchZoom({ zoom: NO_ZOOM, mid: { x: 0, y: 0 }, spread: 100 }, { x: 0, y: 0 }, 40, box).s).toBe(1);
    expect(pinchZoom({ zoom: NO_ZOOM, mid: { x: 0, y: 0 }, spread: 10 }, { x: 0, y: 0 }, 1000, box).s).toBe(PHOTO_ZOOM.max);
  });

  it('never lets a gap open at an edge of the photo', () => {
    const frame = { x: 20, y: 0, w: 300, h: 300 };
    // Dragged too far right and down: back to its left and top edges.
    expect(clampZoom({ s: 2, x: 50, y: 40 }, frame)).toEqual({ s: 2, x: -20, y: 0 });
    // Too far left and up: its right and bottom edges.
    expect(clampZoom({ s: 2, x: -900, y: -900 }, frame)).toEqual({ s: 2, x: -320, y: -300 });
    // Inside: as it is.
    expect(clampZoom({ s: 2, x: -100, y: -100 }, frame)).toEqual({ s: 2, x: -100, y: -100 });
    // Below 1×: the whole photo again.
    expect(clampZoom({ s: 0.6, x: 30, y: 30 }, frame)).toEqual({ s: 1, x: 0, y: 0 });
  });
});
