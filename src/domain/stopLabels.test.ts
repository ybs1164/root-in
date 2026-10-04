import { describe, expect, it } from 'vitest';
import { labelRect, labelSide, placeLabels } from './stopLabels';

const at = { x: 100, y: 100 };

describe('stop name placement', () => {
  it('goes below a stop, like a day’s pings', () => {
    expect(labelSide(at, [])).toBe('below');
    expect(labelSide(at, [{ x: 200, y: 100 }])).toBe('below'); // a line off to the right
    expect(labelSide(at, [{ x: 100, y: 0 }])).toBe('below'); // …or straight up
  });

  it('moves off a line that runs where it would go', () => {
    expect(labelSide(at, [{ x: 110, y: 200 }])).toBe('above'); // a line heading down
    expect(labelSide(at, [{ x: 100, y: 200 }, { x: 100, y: 0 }])).toBe('right'); // up and down
    expect(labelSide(at, [{ x: 100, y: 200 }, { x: 100, y: 0 }, { x: 200, y: 100 }])).toBe('left');
  });

  it('keeps names along a route off each other and off the other stops', () => {
    const size = { w: 90, h: 16 };
    // Two stops side by side, a line between them: both names can't go below.
    const pts = [{ x: 100, y: 100 }, { x: 150, y: 104 }];
    const sides = placeLabels(pts, [size, size]);
    expect(sides[0]).toBe('below');
    expect(sides[1]).not.toBe('below');
    const [a, b] = sides.map((s, i) => labelRect(pts[i], size, s));
    expect(a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b).toBe(false);
    // Far apart: each simply below.
    expect(placeLabels([{ x: 0, y: 0 }, { x: 300, y: 0 }], [size, size])).toEqual(['below', 'below']);
  });
});
