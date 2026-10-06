import { describe, expect, it } from 'vitest';
import type { AreaShapes } from './adminAreas';
import { placeAreaLabels } from './areaLabels';
import type { MapViewport, Ring } from './districtMap';
import { screenProjection } from './districtRendering';

const viewport: MapViewport = { bounds: { west: 127, south: 37, east: 127.04, north: 37.04 }, widthPx: 400 };
const square = (west: number, south: number, size: number): Ring =>
  [[west, south], [west + size, south], [west + size, south + size], [west, south + size], [west, south]];
const toPx = (p: [number, number]) => {
  const q = screenProjection(viewport).project(p);
  return [q.X / 100, q.Y / 100];
};

describe('area name labels', () => {
  it('puts one label inside each area with room, none in one too small', () => {
    const shapes: AreaShapes = {
      parts: [[square(127.005, 37.005, 0.015)], [square(127.025, 37.005, 0.0005)]],
      others: [[square(127.005, 37.022, 0.015)]],
      partTags: [{ key: 'a', name: '역삼1동' }, { key: 'tiny', name: '아주작은동' }],
      otherTags: [{ key: 'c', name: '논현동' }],
    };
    const labels = placeAreaLabels(shapes, viewport);
    expect(labels.map((l) => [l.key, l.part])).toEqual([['a', true], ['c', false]]);
    const [x, y] = toPx(labels[0].at);
    const [x0, y0] = toPx([127.005, 37.005]);
    const [x1, y1] = toPx([127.02, 37.02]);
    expect(x).toBeGreaterThan(x0);
    expect(x).toBeLessThan(x1);
    expect(y).toBeGreaterThan(Math.min(y0, y1));
    expect(y).toBeLessThan(Math.max(y0, y1));
  });

  it('gives a 읍면동 split into sections one label, and keeps a label that still fits where it was', () => {
    const shapes: AreaShapes = {
      parts: [[square(127.005, 37.005, 0.012)], [square(127.019, 37.005, 0.012)]],
      others: [],
      partTags: [{ key: 'd', name: '역삼1동' }, { key: 'd', name: '역삼1동' }],
      otherTags: [],
    };
    const first = placeAreaLabels(shapes, viewport);
    expect(first).toHaveLength(1);
    const panned: MapViewport = { ...viewport, bounds: { west: 127.002, south: 37.001, east: 127.042, north: 37.041 } };
    expect(placeAreaLabels(shapes, panned, first)[0].at).toBe(first[0].at);
  });

  it('gives a 읍면동 drawn both split and whole (zoomed past it) one label', () => {
    const shapes: AreaShapes = {
      parts: [[square(127.005, 37.005, 0.012)]],
      others: [[square(127.019, 37.005, 0.012)]],
      partTags: [{ key: 'd', name: '역삼1동' }],
      otherTags: [{ key: 'd', name: '역삼1동' }],
    };
    expect(placeAreaLabels(shapes, viewport).map((l) => [l.key, l.part])).toEqual([['d', true]]);
  });

  it('skips areas off screen and polygons without names', () => {
    const shapes: AreaShapes = {
      parts: [[square(127.2, 37.2, 0.02)], [square(127.005, 37.005, 0.015)]],
      others: [],
      partTags: [{ key: 'far', name: '먼동' }, { key: 'x', name: '' }],
    };
    expect(placeAreaLabels(shapes, viewport)).toEqual([]);
  });
});
