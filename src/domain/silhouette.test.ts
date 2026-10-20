import { describe, expect, it } from 'vitest';
import { inPolygon, type MapPoint } from './miniMap';
import { ringArea, roundCorners, silhouette, silhouetteStats, STOP_ROOM, visvalingam } from './silhouette';

const rect = (x0: number, y0: number, x1: number, y1: number): MapPoint[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
const box = (rings: MapPoint[][]) => {
  const all = rings.flat();
  return {
    x0: Math.min(...all.map((p) => p.x)),
    x1: Math.max(...all.map((p) => p.x)),
    y0: Math.min(...all.map((p) => p.y)),
    y1: Math.max(...all.map((p) => p.y)),
  };
};
const inside = (rings: MapPoint[][], p: MapPoint) => rings.some((ring) => inPolygon(p, ring));

describe('미니맵 실루엣', () => {
  it('fills the bites between narrow teeth (closing)', () => {
    // A block with a comb of 0.02 wide teeth on top, 0.03 apart.
    const teeth = Array.from({ length: 10 }, (_, k) => [rect(0.2 + k * 0.05, 0.4, 0.22 + k * 0.05, 0.5)]);
    const out = silhouette([[rect(0.2, 0.5, 0.7, 0.8)], ...teeth], [{ x: 0.45, y: 0.65 }]);
    expect(out).toHaveLength(1);
    expect(silhouetteStats(out).solidity).toBeGreaterThan(0.95);
    // The teeth are cut down to stubs, the bites between them gone.
    expect(box(out).y0).toBeGreaterThan(0.47);
  });

  it('cuts away a thin arm with no stop on it (opening), keeps land round a stop at an arm’s tip', () => {
    const body = rect(0.3, 0.3, 0.6, 0.6);
    const arm = rect(0.6, 0.44, 0.95, 0.46);
    const cut = silhouette([[body], [arm]], [{ x: 0.45, y: 0.45 }]);
    expect(box(cut).x1).toBeLessThan(0.63);
    // The body's own corners are given back, not melted round.
    expect(inside(cut, { x: 0.305, y: 0.305 })).toBe(true);
    expect(inside(cut, { x: 0.595, y: 0.595 })).toBe(true);
    // A stop at the arm's end: land stays round it, whatever is cut.
    const tip = { x: 0.93, y: 0.45 };
    const kept = silhouette([[body], [arm]], [{ x: 0.45, y: 0.45 }, tip]);
    expect(inside(kept, tip)).toBe(true);
    expect(inside(kept, { x: tip.x, y: tip.y - STOP_ROOM * 0.8 })).toBe(true);
  });

  it('turns steps into one line, with far fewer sharp turns', () => {
    // A staircase down a diagonal, steps of 0.012.
    const steps: MapPoint[] = [{ x: 0.2, y: 0.2 }];
    for (let k = 0; k < 40; k++) {
      steps.push({ x: 0.2 + (k + 1) * 0.012, y: 0.2 + k * 0.012 });
      steps.push({ x: 0.2 + (k + 1) * 0.012, y: 0.2 + (k + 1) * 0.012 });
    }
    steps.push({ x: 0.2, y: 0.2 + 40 * 0.012 });
    const before = silhouetteStats([steps]);
    const after = silhouetteStats(silhouette([[steps]], [{ x: 0.3, y: 0.55 }]));
    expect(after.wiggle).toBeLessThan(before.wiggle / 3);
  });

  it('keeps only the pieces with a stop on them', () => {
    const main = rect(0.2, 0.2, 0.6, 0.6);
    const speck = rect(0.8, 0.8, 0.84, 0.84);
    expect(silhouette([[main], [speck]], [{ x: 0.4, y: 0.4 }])).toHaveLength(1);
    expect(silhouette([[main], [speck]], [{ x: 0.4, y: 0.4 }, { x: 0.82, y: 0.82 }])).toHaveLength(2);
    expect(silhouette([[main], [rect(0.8, 0.2, 1.1, 0.5)]], [{ x: 0.4, y: 0.4 }])).toHaveLength(1);
  });

  it('fills holes, keeps a long edge straight and a corner crisp', () => {
    const out = silhouette([[rect(0.2, 0.3, 0.8, 0.7), rect(0.45, 0.45, 0.5, 0.5)]], [{ x: 0.3, y: 0.4 }]);
    expect(out).toHaveLength(1);
    expect(inside(out, { x: 0.475, y: 0.475 })).toBe(true);
    // The top edge's middle is one straight segment at its height.
    const ring = out[0];
    const straight = ring.some((p, i) => {
      const q = ring[(i + 1) % ring.length];
      return Math.abs(p.y - 0.3) < 0.005 && Math.abs(q.y - 0.3) < 0.005 && Math.min(p.x, q.x) < 0.3 && Math.max(p.x, q.x) > 0.7;
    });
    expect(straight).toBe(true);
    // The corner is only eased: a little in from its point is land.
    expect(inside(out, { x: 0.206, y: 0.306 })).toBe(true);
  });

  it('measures how solid an outline is', () => {
    expect(silhouetteStats([rect(0, 0, 1, 1)]).solidity).toBeCloseTo(1, 6);
    const L = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.3 }, { x: 0.3, y: 0.3 }, { x: 0.3, y: 1 }, { x: 0, y: 1 }];
    expect(silhouetteStats([L]).solidity).toBeLessThan(0.75);
  });

  it('drops the smallest wiggles first and rounds corners within half an edge', () => {
    const bumpy = [{ x: 0, y: 0 }, { x: 0.5, y: 0.001 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    expect(visvalingam(bumpy, 0.001, 4)).toHaveLength(4);
    const square = rect(0, 0, 1, 1);
    const round = roundCorners(square, 0.1);
    expect(ringArea(round)).toBeLessThan(1);
    expect(ringArea(round)).toBeGreaterThan(0.98);
  });
});
