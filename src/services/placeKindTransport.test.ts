import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import type { SharedCourse } from '../types/course';
import type { SharedDiary } from '../types/diary';
import type { Pin, SharedPinSet } from '../types/pin';
import { decodeSharedCourse, encodeSharedCourse } from './courseShareService';
import { decodeSharedDiary, encodeSharedDiary } from './diaryShareService';
import { decodeSharedPinSet, encodeSharedPinSet } from './pinShareService';
import { LocalPinRepository, readStoredPins } from './pinRepository';
import { pinsCollection, routesCollection } from './syncCollections';

// PlaceRef.kind (docs/plan-auto-icon.md, I3) must survive every way a place
// leaves this device, and arrive only as a known id.

const toToken = (payload: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const cafe = { ...samplePlaces.onionSeongsu, kind: 'bakery' as const };
const stop = { i: 'a', n: 'b', c: [127.05, 37.54] };

describe('course links', () => {
  const course: SharedCourse = {
    title: '성수',
    theme: 'date',
    travelMode: 'walk',
    stops: [{ place: cafe }, { place: samplePlaces.seoulForest }],
    sharedAt: '2026-10-19T00:00:00.000Z',
  };

  it('round-trips kind, and stops without one stay without', () => {
    const back = decodeSharedCourse(encodeSharedCourse(course).token);
    expect(back?.stops[0].place.kind).toBe('bakery');
    expect(back?.stops[1].place).not.toHaveProperty('kind');
  });

  it('drops unknown kinds; links made before kind still open', () => {
    const payload = { v: 2, t: 't', h: 'date', x: 'walk', a: '', s: [{ ...stop, y: 'evil' }, { ...stop, y: 'toString' }, stop] };
    const back = decodeSharedCourse(toToken(payload));
    expect(back?.stops).toHaveLength(3);
    for (const s of back!.stops) expect(s.place).not.toHaveProperty('kind');
  });
});

describe('day links', () => {
  it('round-trips kind and drops unknown ones', () => {
    const diary: SharedDiary = {
      date: '2026-10-19',
      title: '하루',
      travelMode: 'walk',
      stops: [{ place: cafe, time: '10:00' }, { place: samplePlaces.seoulForest }],
      sharedAt: '2026-10-19T00:00:00.000Z',
    };
    expect(decodeSharedDiary(encodeSharedDiary(diary).token)?.stops[0].place.kind).toBe('bakery');
    const back = decodeSharedDiary(toToken({ v: 1, d: '2026-10-19', t: 't', x: 'walk', a: '', s: [{ ...stop, y: 'nope' }, stop] }));
    expect(back?.stops[0].place).not.toHaveProperty('kind');
  });
});

describe('pin set links', () => {
  it('round-trips kind and drops unknown ones', () => {
    const set: SharedPinSet = {
      title: '핀',
      categories: [{ name: '카페', icon: 'cafe', color: 1 }],
      pins: [{ place: cafe, category: 0 }],
      sharedAt: '',
    };
    const token = encodeSharedPinSet(set).token;
    expect(decodeSharedPinSet(token)?.pins[0].place.kind).toBe('bakery');
    const bad = { v: 1, t: 't', c: [{ n: '카페', ic: 'cafe', co: 1 }], p: [{ ...stop, k: 0, y: 'nope' }], s: '' };
    expect(decodeSharedPinSet(toToken(bad))?.pins[0].place).not.toHaveProperty('kind');
  });
});

describe('sync rows', () => {
  it('pins keep a known kind and lose an unknown one', () => {
    const row = (kind: string) => ({ id: 'x', category_id: 'none', place: { id: 'p', name: 'n', center: [127, 37], kind } });
    expect(pinsCollection.fromRemote(row('cafe'))).toMatchObject({ place: { kind: 'cafe' } });
    const bad = pinsCollection.fromRemote(row('evil')) as { place: object } | null;
    expect(bad?.place).not.toHaveProperty('kind');
  });

  it('route stops keep a known kind and lose an unknown one', () => {
    const route = routesCollection.fromRemote({
      id: 'r',
      title: 't',
      stops: [{ place: { id: 'a', name: 'a', center: [127, 37], kind: 'park' } }, { place: { id: 'b', name: 'b', center: [127, 37], kind: 'evil' } }],
    }) as { stops: { place: object }[] } | null;
    expect(route?.stops[0].place).toMatchObject({ kind: 'park' });
    expect(route?.stops[1].place).not.toHaveProperty('kind');
  });
});

describe('saved pins', () => {
  it('keep a known kind and lose a hand-edited one on load', async () => {
    const pin = (id: string, kind: string) => ({ id, userId: 'u1', categoryId: 'none', createdAt: '', place: { ...samplePlaces.onionSeongsu, kind } });
    localStorage.setItem('goodroot:pins:v1', JSON.stringify([pin('ok', 'cafe'), pin('bad', 'evil')]));
    const [ok, bad] = await new LocalPinRepository().listByUser('u1');
    expect(ok.place.kind).toBe('cafe');
    expect(bad.place).not.toHaveProperty('kind');
    expect(readStoredPins().map((p: Pin) => p.place.kind)).toEqual(['cafe', undefined]);
  });
});
