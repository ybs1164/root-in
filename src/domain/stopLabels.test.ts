import { describe, expect, it } from 'vitest';
import { fitPingLabels, labelRect, labelSide, pingInfoSize, pingOverlap, placeLabels, placePingLabels } from './stopLabels';

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

describe('ping name placement', () => {
  const info = (name: string, time = '12:00', latest = false) => ({ name, time, latest });

  it('goes below a lone pin, and off a line that runs under it', () => {
    expect(placePingLabels([{ x: 100, y: 100 }], [pingInfoSize('카페', '10:00')])).toEqual(['below']);
    // The next ping straight below: the line would run through a name put below.
    const [side] = placePingLabels([{ x: 100, y: 100 }, { x: 100, y: 220 }], [pingInfoSize('어니언 성수', '10:00'), pingInfoSize('서울숲', '11:00')]);
    expect(side).not.toBe('below');
  });

  it('finds a clean picture for a crowded row of pins', () => {
    // Six pins 40px apart in a row, as on a day spent on one street: every name in full, none touching.
    const points = [0, 1, 2, 3, 4, 5].map((k) => ({ x: 60 + k * 40, y: 160 }));
    const sizes = ['어니언 성수', '성수 갈비집', '대림창고', '서울숲', '카페 B', '소품샵'].map((n) => pingInfoSize(n, '12:00'));
    expect(pingOverlap(points, sizes)).toBe(0);
  });

  it('writes crowded infos shorter: the time goes first, then the name is cut, and the latest keeps its time', () => {
    // Too close for every info in full: five pins 10px apart.
    const points = [0, 1, 2, 3, 4].map((k) => ({ x: 100 + k * 10, y: 100 + (k % 2) * 4 }));
    const names = ['성수동 카페거리 끝집', '성수 갈비집 본점', '대림창고 갤러리', '서울숲 공원 입구', '어니언 성수 본점'];
    const fitted = fitPingLabels(points, names.map((n, i) => info(n, i === 4 ? '14:10' : '12:00', i === 4)));
    expect(fitted[4].time).toBe('14:10');
    const dropped = fitted.filter((f) => f.time === undefined);
    expect(dropped.length).toBeGreaterThan(0);
    // A name is only cut where its time is already gone.
    for (const f of fitted.filter((f) => f.name.endsWith('…'))) expect(f.time).toBeUndefined();
    expect(fitted.some((f) => f.name.endsWith('…'))).toBe(true);
    // Room enough: everything is written in full.
    const roomy = fitPingLabels([{ x: 50, y: 100 }, { x: 250, y: 100 }], [info('카페'), info('식당')]);
    expect(roomy).toEqual([
      { side: 'below', name: '카페', time: '12:00' },
      { side: 'below', name: '식당', time: '12:00' },
    ]);
  });
});
