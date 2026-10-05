import { describe, expect, it } from 'vitest';
import type { Course } from '../types/course';
import type { DayPing } from './dayPings';
import { BACK_CARD, cardToScene, CLOTHESLINE, clotheslineY, DEFAULT_LAYOUT, DRAWING_BOX, FRONT_CARD, LAYOUT_CARDS, POLAROID, SCENE, sceneToCard, STRIP } from './polaroid';
import type { ExcludedPlace } from './privacy';
import { cardTitleText, dayCardTitle, daySubject, routeSubject, withCardTitle, withLayout } from './shareSubject';

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
      stickers: [{ id: 's', stickerId: 'star', x: 0.2, y: 0.3, size: 0.2 }],
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
    expect(s.title).toBe('성수 데이트');
    expect(s.pings.map((p) => [p.name, p.time])).toEqual([['어니언', ''], ['대림창고', ''], ['서울숲', '']]);
    expect(s.marks).toEqual(['number', 'number', 'heart']);
    expect(s.edges).toEqual(['dashed', 'solid']);
    expect(s.removed).toBe(0);
    const transparent = routeSubject({ ...course, stopShapes: ['transparent', null, 'transparent'], edgeStyles: ['transparent', null] }, [], ['cafe', 'food', 'nature']);
    expect(transparent.marks).toEqual(['transparent', 'number', 'transparent']);
    expect(transparent.edges).toEqual(['transparent', 'solid']);
    expect(transparent.icons).toEqual(['cafe', 'food', 'nature']);
    const cut = routeSubject({ ...course, stopShapes: ['transparent', null, 'transparent'] }, [{ ...home, center: course.stops[1].place.center }], ['cafe', 'food', 'nature']);
    expect(cut.icons).toEqual(['cafe', 'nature']);
    expect(cut.marks).toEqual(['transparent', 'transparent']);
  });

  it('write a day’s date toward the strip’s bottom right, a route’s name in its middle', () => {
    const front = LAYOUT_CARDS[DEFAULT_LAYOUT].front;
    const date = withCardTitle({ stickers: [], strokes: [] }, '09.29', daySubject('2026-09-29', [], () => 'pin', () => 'solid', []).titleAt).texts![0];
    const onCard = sceneToCard(front, date.x * SCENE.w, date.y * SCENE.h);
    expect(onCard.x).toBeGreaterThan(POLAROID.w * 0.7);
    expect(onCard.y).toBeGreaterThan(STRIP.y + STRIP.h / 2);
    expect(date.align).toBe('right');
    expect(date.rotate).toBe(front.angle);
    const name = cardTitleText('성수 데이트');
    expect(sceneToCard(front, name.x * SCENE.w, name.y * SCENE.h).x).toBeCloseTo(POLAROID.w / 2);
  });

  it('title a day’s card like a date on a print', () => {
    expect(dayCardTitle('2026-01-09')).toBe('01.09');
  });

  it('put the title down once as a text box on the front card’s strip, which can then be thrown away for good', () => {
    const t = cardTitleText('성수 데이트', 'stack');
    const strip = cardToScene(FRONT_CARD, POLAROID.w / 2, STRIP.y + STRIP.h / 2);
    expect(t.text).toBe('성수 데이트');
    // Around the middle of the strip.
    expect(Math.abs(t.x * SCENE.w - strip.x)).toBeLessThan(20);
    expect(Math.abs(t.y * SCENE.h - strip.y)).toBeLessThan(20);
    expect(t.rotate).toBe(FRONT_CARD.angle);
    const first = withCardTitle({ stickers: [], strokes: [] }, '성수 데이트');
    expect(first.texts?.map((x) => x.text)).toEqual(['성수 데이트']);
    expect(first.titled).toBe(true);
    // Thrown away: it doesn't come back next time.
    const gone = { ...first, texts: [] };
    expect(withCardTitle(gone, '성수 데이트').texts).toEqual([]);
  });

  it('a new card is laid out as 탑승권, its title on that smaller card', () => {
    const fresh = withCardTitle({ stickers: [], strokes: [] }, '성수');
    expect(fresh.layout).toBeUndefined();
    const front = LAYOUT_CARDS[DEFAULT_LAYOUT].front;
    const strip = cardToScene(front, POLAROID.w / 2, STRIP.y + STRIP.h / 2);
    expect(DEFAULT_LAYOUT).toBe('ticket');
    expect(Math.abs(fresh.texts![0].x * SCENE.w - strip.x)).toBeLessThan(20);
    expect(Math.abs(fresh.texts![0].y * SCENE.h - strip.y)).toBeLessThan(20);
    expect(fresh.texts![0].rotate).toBe(front.angle);
  });

  it('switching layouts carries the title box with the photo card (where it sat on the card, its turn and size); other pieces stay put', () => {
    const sticker = { id: 's', stickerId: 'star', x: 0.1, y: 0.1, size: 0.1 };
    const start = { ...withCardTitle({ stickers: [sticker], strokes: [], layout: 'stack' as const }, '성수') };
    // Nudged a little on its card.
    start.texts = start.texts!.map((t) => ({ ...t, x: t.x + 0.01, rotate: (t.rotate ?? 0) + 5 }));
    const onStack = sceneToCard(FRONT_CARD, start.texts[0].x * SCENE.w, start.texts[0].y * SCENE.h);
    for (const layout of ['map', 'notebook', 'ticket'] as const) {
      const next = withLayout(start, layout);
      const t = next.texts![0];
      const to = LAYOUT_CARDS[layout].front;
      const onCard = sceneToCard(to, t.x * SCENE.w, t.y * SCENE.h);
      expect(next.layout).toBe(layout);
      expect(Math.abs(onCard.x - onStack.x)).toBeLessThan(1);
      expect(Math.abs(onCard.y - onStack.y)).toBeLessThan(1);
      expect(t.rotate).toBeCloseTo(to.angle + 5);
      expect(t.size).toBeCloseTo(start.texts[0].size * (to.scale ?? 1));
      expect(next.stickers).toEqual([sticker]);
      // And back again lands where it started.
      const back = withLayout(next, 'stack').texts![0];
      expect(back.x).toBeCloseTo(start.texts[0].x);
      expect(back.y).toBeCloseTo(start.texts[0].y);
    }
  });

  it('빨랫줄: the line sags over the card and each peg on it reaches down over the card’s top edge', () => {
    const front = LAYOUT_CARDS.line.front;
    const top = cardToScene(front, POLAROID.w / 2, 0).y;
    expect(clotheslineY(700)).toBeLessThan(top);
    expect(clotheslineY(700)).toBeGreaterThan(clotheslineY(100));
    for (const x of CLOTHESLINE.pegs) {
      const y = clotheslineY(x);
      // A peg spans 70px above the line to 150px below it.
      expect(y - 70).toBeLessThan(top);
      expect(y + 150).toBeGreaterThan(top);
      expect(Math.abs(x - front.cx)).toBeLessThan((POLAROID.w * (front.scale ?? 1)) / 2);
    }
  });

  it('a route card’s stamp says when, how many stops and where (FROM → TO, and the area in Korean)', () => {
    const course = {
      id: 'c1', userId: 'u', title: '성수', theme: 'etc' as const, travelMode: 'walk' as const, createdAt: '2026-10-05T03:00:00.000Z',
      stops: [
        { place: { id: 'a', name: '어니언', center: [127.0582, 37.5447] as [number, number], address: '서울 성동구 성수동1가 13' } },
        { place: { id: 'b', name: '서울숲', center: [127.0374, 37.5444] as [number, number] } },
      ],
    };
    const { stamp } = routeSubject(course, []);
    expect(stamp).toEqual({ date: '2026-10-05', stops: 2, from: 'Seoul', to: 'Seongsu', area: '성수' });
    expect(daySubject('2026-09-30', [], () => 'pin', () => 'solid', []).stamp).toEqual({ date: '2026-09-30', stops: 0 });
  });
});
