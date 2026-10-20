import { describe, expect, it } from 'vitest';
import type { BaseMap } from './baseMap';
import { MIN_POND_PX, MIN_SHAPE_PX, shapeBaseMap } from './baseShapes';
import type { MapViewport, Ring } from './districtMap';

// A screen 400px wide over 0.04° of longitude at the equator: 1px = 0.0001°.
const PX = 0.0001;
const screen: MapViewport = { bounds: { west: 0, south: 0, east: 400 * PX, north: 400 * PX }, widthPx: 400 };
const square = (x: number, y: number, sizePx: number): Ring => {
  const [w, s, e, n] = [x * PX, y * PX, (x + sizePx) * PX, (y + sizePx) * PX];
  return [[w, s], [e, s], [e, n], [w, n], [w, s]];
};
const empty: BaseMap = { land: [], parks: [], roads: [] };

describe('shapeBaseMap', () => {
  it('drops land and parks too small to see on this screen', () => {
    const shaped = shapeBaseMap({ ...empty, land: [[square(10, 10, MIN_SHAPE_PX - 1)], [square(50, 50, 40)]], parks: [[square(0, 0, 1)]] }, screen);
    expect(shaped.land).toHaveLength(1);
    expect(shaped.parks).toHaveLength(0);
  });

  it('fills ponds too small to read as water, keeps the bigger ones', () => {
    const land: BaseMap['land'] = [[square(0, 0, 300), square(20, 20, MIN_POND_PX - 2), square(100, 100, 60)]];
    const [[, ...holes]] = shapeBaseMap({ ...empty, land }, screen).land;
    expect(holes).toHaveLength(1);
    expect(holes[0][0][0]).toBeCloseTo(100 * PX);
  });

  it('simplifies outlines to about a pixel: a wobble under a pixel goes, a real corner stays', () => {
    // A 200px square whose bottom edge wobbles by a fraction of a pixel at every pixel.
    const bottom = Array.from({ length: 199 }, (_, i) => [(i + 1) * PX, (i % 2 ? 0.3 : -0.3) * PX] as [number, number]);
    const ring: Ring = [[0, 0], ...bottom, [200 * PX, 0], [200 * PX, 200 * PX], [0, 200 * PX], [0, 0]];
    const [[outer]] = shapeBaseMap({ ...empty, land: [[ring]] }, screen).land;
    expect(outer.length).toBeLessThanOrEqual(6);
    expect(outer).toContainEqual([200 * PX, 200 * PX]);
    expect(outer[0]).toEqual(outer[outer.length - 1]);
  });

  it('uses the screen scale of its latitude: the same box is taller in pixels further north', () => {
    // At 60°N a degree of latitude is twice as many pixels as a degree of longitude.
    const north: MapViewport = { bounds: { west: 0, south: 59.98, east: 400 * PX, north: 60.02 }, widthPx: 400 };
    const flat: Ring = [[0, 60], [2 * PX, 60], [2 * PX, 60 + 2 * PX], [0, 60 + 2 * PX], [0, 60]];
    expect(shapeBaseMap({ ...empty, land: [[flat]] }, screen).land).toHaveLength(0);
    expect(shapeBaseMap({ ...empty, land: [[flat]] }, north).land).toHaveLength(1);
  });

  it('drops roads shorter than a couple of pixels and puts the narrow tiers first', () => {
    const roads: BaseMap['roads'] = [
      { tier: 1, path: [[0, 0], [100 * PX, 0]] },
      { tier: 4, path: [[0, 10 * PX], [100 * PX, 10 * PX]] },
      { tier: 2, path: [[0, 0], [PX, 0]] },
    ];
    expect(shapeBaseMap({ ...empty, roads }, screen).roads.map((r) => r.tier)).toEqual([4, 1]);
  });
});
