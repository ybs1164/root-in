import { describe, expect, it } from 'vitest';
import {
  bboxContains,
  buildDistrictMap,
  DEFAULT_DISTRICT_OPTIONS,
  districtOptionsFor,
  mergeDualCarriageways,
  pruneDeadEnds,
  viewportRegion,
  type Bbox,
  type LonLat,
  type RoadSegment,
} from './districtMap';

// About 1.1km × 1.1km around Seoul City Hall.
const small: Bbox = { west: 126.972, south: 37.561, east: 126.984, north: 37.571 };

describe('viewportRegion', () => {
  it('pads the screen so the rounded region edge stays off-screen', () => {
    const region = viewportRegion(small)!;
    expect(bboxContains(region.bbox, small)).toBe(true);
    expect(region.bbox.west).toBeLessThan(small.west);
    expect(region.bbox.north).toBeGreaterThan(small.north);
    expect(region.region).toHaveLength(4);
  });

  it('includes residential streets only when zoomed in', () => {
    expect(viewportRegion(small)!.includeMinor).toBe(true);
    const wide: Bbox = { west: 126.95, south: 37.55, east: 126.99, north: 37.58 };
    expect(viewportRegion(wide)!.includeMinor).toBe(false);
  });

  it('gives up at city scale and on degenerate bounds', () => {
    expect(viewportRegion({ west: 126.8, south: 37.45, east: 127.15, north: 37.7 })).toBeNull();
    expect(viewportRegion({ west: 127, south: 37.5, east: 127, north: 37.5 })).toBeNull();
  });
});

describe('buildDistrictMap on a viewport', () => {
  it('splits the screen into blocks along a road', () => {
    const region = viewportRegion(small)!;
    const midLon = (small.west + small.east) / 2;
    const map = buildDistrictMap(region.region, [
      { kind: 'major', path: [[midLon, region.bbox.south - 0.01], [midLon, region.bbox.north + 0.01]] },
    ]);
    expect(map.blocks).toHaveLength(2);
  });
});

describe('districtOptionsFor', () => {
  it('keeps both road classes between 4 and 8 screen pixels', () => {
    // Zoomed in (0.5 m/px): 30m and 18m would be 60px and 36px.
    const near = districtOptionsFor(0.5);
    expect(near.majorWidth / 0.5).toBe(8);
    expect(near.minorWidth / 0.5).toBe(8);
    // Zoomed out (10 m/px): they would be 3px and 1.8px.
    const far = districtOptionsFor(10);
    expect(far.majorWidth / 10).toBe(4);
    expect(far.minorWidth / 10).toBe(4);
    // In between the real widths survive.
    const mid = districtOptionsFor(4.5);
    expect(mid.majorWidth).toBe(DEFAULT_DISTRICT_OPTIONS.majorWidth);
    expect(mid.minorWidth).toBe(DEFAULT_DISTRICT_OPTIONS.minorWidth);
  });

  it('caps the corner radius so narrow blocks survive when zoomed in', () => {
    expect(districtOptionsFor(0.5).cornerRadius).toBe(4);
    expect(districtOptionsFor(10).cornerRadius).toBe(DEFAULT_DISTRICT_OPTIONS.cornerRadius);
  });
});

describe('pruneDeadEnds', () => {
  // Unit square region; roads that leave it carry on off-screen.
  const region: LonLat[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const road = (...path: LonLat[]): RoadSegment => ({ kind: 'minor', path });
  const through = road([-0.5, 0.5], [0.5, 0.5], [1.5, 0.5]);

  it('keeps roads that run through the region', () => {
    expect(pruneDeadEnds([through], region)).toEqual([through]);
  });

  it('drops a spur that stops inside a block', () => {
    const spur = road([0.5, 0.5], [0.5, 0.7], [0.5, 0.8]);
    expect(pruneDeadEnds([through, spur], region)).toEqual([through]);
  });

  it('drops whole dead-end branches, not just the last segment', () => {
    const stem = road([0.3, 0.5], [0.3, 0.7]);
    const forkA = road([0.3, 0.7], [0.2, 0.9]);
    const forkB = road([0.3, 0.7], [0.4, 0.9]);
    expect(pruneDeadEnds([through, stem, forkA, forkB], region)).toEqual([through]);
  });

  it('keeps a crossing road and trims only its dangling tail', () => {
    const junctioned = road([-0.5, 0.5], [0.2, 0.5], [0.5, 0.5], [1.5, 0.5]);
    const cross = road([0.5, -0.5], [0.5, 0.5], [0.5, 1.5]);
    const tailed = road([0.2, -0.5], [0.2, 0.5], [0.2, 0.8]);
    expect(pruneDeadEnds([junctioned, cross, tailed], region)).toEqual([
      junctioned,
      cross,
      road([0.2, -0.5], [0.2, 0.5]),
    ]);
  });

  it('drops a road that comes in from outside and stops without meeting another', () => {
    const notch = road([0.2, -0.5], [0.2, 0.3]);
    expect(pruneDeadEnds([through, notch], region)).toEqual([through]);
  });

  it('keeps a road that leaves the region at its far end', () => {
    const exit = road([0.5, 0.5], [0.5, 1.5]);
    expect(pruneDeadEnds([through, exit], region)).toEqual([through, exit]);
  });
});

describe('mergeDualCarriageways', () => {
  // ~20m apart at Seoul's latitude (0.00018° lat).
  const north: RoadSegment = { kind: 'major', oneway: true, name: '세종대로', path: [[127, 37.50018], [127.01, 37.50018]] };
  const south: RoadSegment = { kind: 'major', oneway: true, name: '세종대로', path: [[127.01, 37.5], [127, 37.5]] };

  it('pulls opposite carriageways onto their shared midline', () => {
    const [a, b] = mergeDualCarriageways([north, south]);
    for (const p of [...a.path, ...b.path]) expect(p[1]).toBeCloseTo(37.50009, 6);
  });

  it('moves side streets with the carriageway they join', () => {
    const side: RoadSegment = { kind: 'minor', path: [[127.005, 37.51], [127, 37.50018]] };
    const [, , moved] = mergeDualCarriageways([north, south, side]);
    expect(moved.path[1][1]).toBeCloseTo(37.50009, 6);
  });

  it('leaves same-direction, differently named, or far-apart roads alone', () => {
    const sameDir = { ...south, path: [...south.path].reverse() as LonLat[] };
    expect(mergeDualCarriageways([north, sameDir])).toEqual([north, sameDir]);
    const otherName = { ...south, name: '태평로' };
    expect(mergeDualCarriageways([north, otherName])).toEqual([north, otherName]);
    const far = { ...south, path: south.path.map(([x, y]) => [x, y - 0.001]) as LonLat[] };
    expect(mergeDualCarriageways([north, far])).toEqual([north, far]);
  });
});
