import { describe, expect, it } from 'vitest';
import { ROAD_TIERS, type BaseMap } from './baseMap';
import { CLOSE_PX, MIN_POND_PX, MIN_SHAPE_PX, OPEN_PX, shapeBaseMap } from './baseShapes';
import type { MapViewport, Ring } from './districtMap';

// A screen 400px wide over 0.04° of longitude at the equator: 1px = 0.0001°.
const PX = 0.0001;
const screen: MapViewport = { bounds: { west: 0, south: 0, east: 400 * PX, north: 400 * PX }, widthPx: 400 };
const rect = (x: number, y: number, w: number, h = w): Ring => {
  const [west, south, east, north] = [x * PX, y * PX, (x + w) * PX, (y + h) * PX];
  return [[west, south], [east, south], [east, north], [west, north], [west, south]];
};
const square = (x: number, y: number, sizePx: number) => rect(x, y, sizePx);
const empty: BaseMap = { land: [], parks: [], roads: [] };
/** Every point of the shaped land, in screen px. */
const pointsPx = (land: ReturnType<typeof shapeBaseMap>['land']) => land.flat(2).map(([x, y]) => [x / PX, y / PX]);

describe('shapeBaseMap', () => {
  it('drops land too small to see on this screen', () => {
    const shaped = shapeBaseMap({ ...empty, land: [[square(10, 10, MIN_SHAPE_PX - 2)], [square(50, 50, 40)]] }, screen);
    expect(shaped.land).toHaveLength(1);
  });

  it('keeps parks and roads at neighborhood scale', () => {
    const shaped = shapeBaseMap({ land: [[square(0, 0, 50)]], parks: [[square(0, 0, 50)]], roads: [{ tier: 1, path: [[0, 0], [100 * PX, 0]] }] }, screen);
    expect(shaped.parks).toHaveLength(1);
    expect(shaped.roads).toEqual([{ tier: 1, width: expect.any(Number), path: [[0, 0], [100 * PX, 0]] }]);
  });

  it('reveals local streets and footpaths when zoomed in, including tiles without land', () => {
    const close = { ...screen, widthPx: 4000 };
    const shaped = shapeBaseMap({ ...empty, roads: ROAD_TIERS.map((tier) => ({ tier, path: [[0, 0], [100 * PX, 0]] })) }, close);
    expect(shaped.roads?.map((road) => road.tier)).toEqual([1, 2, 3, 4, 5]);
    expect(shaped.roads?.every((road) => road.width > 0)).toBe(true);
    expect(shapeBaseMap({ ...empty, parks: [[square(0, 0, 50)]], roads: [{ tier: 1, path: [[0, 0], [100 * PX, 0]] }] }, { ...screen, widthPx: 20 })).toMatchObject({ parks: [], roads: [] });
  });

  it('fills ponds too small to read as water, keeps the bigger ones', () => {
    const land: BaseMap['land'] = [[square(0, 0, 300), square(20, 20, MIN_POND_PX - 4), square(100, 100, 60)]];
    const [[, ...holes]] = shapeBaseMap({ ...empty, land }, screen).land;
    expect(holes).toHaveLength(1);
    const [x] = holes[0][0];
    expect(x / PX).toBeGreaterThan(95);
  });

  it('merges pieces that touch (tile seams) into one shape', () => {
    const shaped = shapeBaseMap({ ...empty, land: [[rect(0, 0, 100, 100)], [rect(100, 0, 100, 100)]] }, screen);
    expect(shaped.land).toHaveLength(1);
  });

  it('closes water narrower than a few pixels, keeps a real river', () => {
    const across = (gap: number) => shapeBaseMap({ ...empty, land: [[rect(0, 0, 100, 100)], [rect(100 + gap, 0, 100, 100)]] }, screen).land.length;
    expect(across(2 * CLOSE_PX - 2)).toBe(1);
    expect(across(30)).toBe(2);
  });

  it('shaves off land thinner than a few pixels (a pier), keeps the body', () => {
    // A 100px square with a 3px-wide, 60px-long pier sticking out.
    const shaped = shapeBaseMap({ ...empty, land: [[rect(0, 0, 100, 100)], [rect(100, 48, 60, 2 * OPEN_PX - 3)]] }, screen);
    expect(Math.max(...pointsPx(shaped.land).map(([x]) => x))).toBeLessThan(110);
  });

  it('simplifies and rounds outlines: a sub-pixel wobble goes and corners become soft', () => {
    // A 200px square whose bottom edge wobbles by a fraction of a pixel at every pixel.
    const bottom = Array.from({ length: 199 }, (_, i) => [(i + 1) * PX, (i % 2 ? 0.3 : -0.3) * PX] as [number, number]);
    const ring: Ring = [[0, 0], ...bottom, [200 * PX, 0], [200 * PX, 200 * PX], [0, 200 * PX], [0, 0]];
    const [[outer]] = shapeBaseMap({ ...empty, land: [[ring]] }, screen).land;
    expect(outer[0]).toEqual(outer[outer.length - 1]);
    // The wobble is gone: the bottom edge lies flat (within the simplification), away from the corners.
    const bottomEdge = outer.map(([x, y]) => [x / PX, y / PX]).filter(([x, y]) => x > 20 && x < 180 && y < 50);
    expect(bottomEdge.length).toBeGreaterThan(0);
    expect(Math.max(...bottomEdge.map(([, y]) => Math.abs(y)))).toBeLessThan(2);
    // The corner is cut round: no point at the exact corner, but the shape still reaches near it.
    const pts = outer.map(([x, y]) => [x / PX, y / PX]);
    expect(pts.some(([x, y]) => Math.abs(x - 200) < 0.5 && Math.abs(y - 200) < 0.5)).toBe(false);
    expect(Math.min(...pts.map(([x, y]) => Math.hypot(x - 200, y - 200)))).toBeLessThan(12);
  });

  it('uses the screen scale of its latitude: the same box is taller in pixels further north', () => {
    // At 60°N a degree of latitude is twice as many pixels as a degree of longitude.
    const north: MapViewport = { bounds: { west: 0, south: 59.98, east: 400 * PX, north: 60.02 }, widthPx: 400 };
    // 9px square at the equator (under the 12px minimum); 9 × 18px at 60°N.
    const box: Ring = [[0, 60], [9 * PX, 60], [9 * PX, 60 + 9 * PX], [0, 60 + 9 * PX], [0, 60]];
    const atEquator: Ring = box.map(([x, y]) => [x, y - 60]);
    expect(shapeBaseMap({ ...empty, land: [[atEquator]] }, screen).land).toHaveLength(0);
    expect(shapeBaseMap({ ...empty, land: [[box]] }, north).land).toHaveLength(1);
  });
});
