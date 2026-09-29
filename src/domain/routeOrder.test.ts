import { describe, expect, it } from 'vitest';
import type { LonLat } from './geo';
import { bruteForceOrder, nearestIndex, orderByNearest, pathLength } from './routeOrder';

// Deterministic pseudo-random points around Seongsu (no Math.random in tests).
function points(seed: number, n: number): LonLat[] {
  let s = seed;
  const next = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  return Array.from({ length: n }, () => [127.03 + next() * 0.04, 37.53 + next() * 0.03] as LonLat);
}

describe('route order (선으로 잇기)', () => {
  it('orderByNearest + 2-opt stays within 5% of brute force for up to 8 points', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const pts = points(seed, 4 + (seed % 5));
      const heuristic = pathLength(pts, orderByNearest(pts));
      const best = pathLength(pts, bruteForceOrder(pts));
      expect(heuristic).toBeLessThanOrEqual(best * 1.05);
    }
  });

  it('handles 10 stops (the course maximum) with every point exactly once', () => {
    const pts = points(99, 10);
    const order = orderByNearest(pts);
    expect([...order].sort((a, b) => a - b)).toEqual([...Array(10).keys()]);
  });

  it('untangles an obviously crossed path', () => {
    // A zig-zag along a straight street: the walkable order is left to right.
    const pts: LonLat[] = [
      [127.0, 37.5],
      [127.03, 37.5],
      [127.01, 37.5],
      [127.02, 37.5],
    ];
    const order = orderByNearest(pts);
    const lons = order.map((i) => pts[i][0]);
    const sorted = [...lons].sort((a, b) => a - b);
    expect(lons.join() === sorted.join() || lons.join() === [...sorted].reverse().join()).toBe(true);
  });

  it('keeps a fixed start first', () => {
    const pts = points(7, 6);
    expect(orderByNearest(pts, 3)[0]).toBe(3);
  });

  it('nearestIndex picks the closest point', () => {
    expect(nearestIndex([[127, 37.5], [127.1, 37.6]], [127.09, 37.59])).toBe(1);
  });
});
