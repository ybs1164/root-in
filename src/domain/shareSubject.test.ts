import { describe, expect, it } from 'vitest';
import type { Course } from '../types/course';
import type { DayPing } from './dayPings';
import { BACK_CARD, cardToScene, DRAWING_BOX, FRONT_CARD, POLAROID, SCENE, STRIP } from './polaroid';
import type { ExcludedPlace } from './privacy';
import { dayCardTitle, daySubject, isDecorKey, routeSubject } from './shareSubject';

const home: ExcludedPlace = { id: 'home', kind: 'home', address: '서울 성동구 성수이로 88', center: [127.0557, 37.5431] };
const place = (id: string, name: string, center: [number, number]) => ({ id, name, center, address: '' });

describe('share cards', () => {
  it('are polaroids shaped like the reference card', () => {
    // Reference: 434 × 676 card, 386 × 532 photo inset 24 / 23, a 121 strip.
    expect(POLAROID.h / POLAROID.w).toBeCloseTo(676 / 434, 2);
    expect(POLAROID.photo.w / POLAROID.w).toBeCloseTo(386 / 434, 2);
    expect(POLAROID.photo.h / POLAROID.w).toBeCloseTo(532 / 434, 2);
    expect(STRIP.h / POLAROID.w).toBeCloseTo(121 / 434, 2);
    // The drawing box sits inside the photo.
    expect(DRAWING_BOX.x).toBeGreaterThan(POLAROID.photo.x);
    expect(DRAWING_BOX.y + DRAWING_BOX.size).toBeLessThan(STRIP.y);
  });

  it('lie as two askew polaroids wholly inside a taller-than-wide scene, with backdrop around them', () => {
    expect(SCENE.h).toBeGreaterThan(SCENE.w);
    for (const pose of [FRONT_CARD, BACK_CARD]) {
      expect(pose.angle).not.toBe(0);
      for (const [x, y] of [[0, 0], [POLAROID.w, 0], [0, POLAROID.h], [POLAROID.w, POLAROID.h]]) {
        const p = cardToScene(pose, x, y);
        expect(p.x).toBeGreaterThan(40);
        expect(p.x).toBeLessThan(SCENE.w - 40);
        expect(p.y).toBeGreaterThan(40);
        expect(p.y).toBeLessThan(SCENE.h - 40);
      }
    }
  });

  it('make a day into its pings, cutting the ones on a 제외 주소 and the lines through them', () => {
    const pings: DayPing[] = [
      { name: '어니언', time: '10:30', center: [127.0582, 37.5447] },
      { name: '갈비집', time: '13:00', center: [127.0557, 37.5431] }, // at home: cut
      { name: '서울숲', time: '17:40', center: [127.0374, 37.5444] },
      { name: '카페', time: '19:00', center: [127.04, 37.546] },
    ];
    const s = daySubject(
      '2026-10-03',
      pings,
      (p) => (p.name === '서울숲' ? 'heart' : 'pin'),
      (from) => (from.name === '서울숲' ? 'dotted' : 'dashed'),
      [home],
    );
    expect(s.key).toBe('day:2026-10-03');
    expect(s.title).toBe('10.03');
    expect(s.pings.map((p) => p.name)).toEqual(['어니언', '서울숲', '카페']);
    expect(s.marks).toEqual(['pin', 'heart', 'pin']);
    // 어니언 → 서울숲 only meet because 갈비집 went: a plain line. 서울숲 → 카페 keeps its own.
    expect(s.edges).toEqual(['solid', 'dotted']);
    expect(s.removed).toBe(1);
  });

  it('carry a day’s own 꾸미기 along for the photo: its pieces, theme and pattern', () => {
    const pings: DayPing[] = [{ name: '서울숲', time: '17:40', center: [127.0374, 37.5444] }];
    const decor = {
      stickers: [{ id: 's', emoji: '⭐', x: 0.2, y: 0.3, size: 0.2 }],
      strokes: [],
      texts: [{ id: 't', text: '안녕', x: 0.5, y: 0.5, size: 0.07, font: 'sans' as const, color: 'ink-black', align: 'center' as const }],
      theme: 'mint' as const,
      pattern: 'hearts' as const,
    };
    const s = daySubject('2026-10-03', pings, () => 'pin', () => 'solid', [], decor);
    expect(s.photo).toEqual(decor);
    expect(daySubject('2026-10-03', pings, () => 'pin', () => 'solid', []).photo).toBeUndefined();
  });

  it('make a route into its stops, numbered unless they were given a shape', () => {
    const course: Course = {
      id: 'c-1',
      userId: 'u',
      title: '성수 데이트',
      theme: 'date',
      travelMode: 'walk',
      stops: [
        { place: place('a', '어니언', [127.0582, 37.5447]) },
        { place: place('b', '대림창고', [127.0565, 37.542]) },
        { place: place('c', '서울숲', [127.0374, 37.5444]) },
      ],
      stopShapes: [null, null, 'heart'],
      edgeStyles: ['dashed', null],
      createdAt: '2026-10-01T00:00:00.000Z',
    };
    const s = routeSubject(course, []);
    expect(s.key).toBe('route:c-1');
    expect(s.title).toBe('성수 데이트');
    expect(s.pings.map((p) => [p.name, p.time])).toEqual([['어니언', ''], ['대림창고', ''], ['서울숲', '']]);
    expect(s.marks).toEqual(['number', 'number', 'heart']);
    expect(s.edges).toEqual(['dashed', 'solid']);
    expect(s.removed).toBe(0);
  });

  it('keep their decorations under a day or route key only', () => {
    expect(isDecorKey('day:2026-10-03')).toBe(true);
    expect(isDecorKey('route:3f1c2d4e-aaaa-bbbb-cccc-1234567890ab')).toBe(true);
    expect(isDecorKey('2026-10-03')).toBe(false);
    expect(isDecorKey('route:../x')).toBe(false);
    expect(dayCardTitle('2026-01-09')).toBe('01.09');
  });
});
