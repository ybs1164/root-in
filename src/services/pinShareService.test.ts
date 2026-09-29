import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import type { SharedPinSet } from '../types/pin';
import {
  decodeSharedPinSet,
  encodeSharedPinSet,
  LinkPinShareService,
  MAX_PINS_TOKEN_LENGTH,
  readPinsToken,
} from './pinShareService';

const toToken = (payload: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const set = (overrides: Partial<SharedPinSet> = {}): SharedPinSet => ({
  title: '성수 디저트',
  categories: [
    { name: '카페', icon: 'cafe', color: 1 },
    { name: '디저트', icon: 'cafe', color: 5, parent: 0 },
  ],
  pins: [
    { place: { ...samplePlaces.onionSeongsu, address: '서울 성동구 아차산로9길 8' }, category: 1, memo: '크루아상' },
    { place: samplePlaces.seoulForest, category: 0 },
  ],
  sharedBy: '지우',
  sharedAt: '2026-09-29T10:00:00.000Z',
  ...overrides,
});

const wire = {
  v: 1,
  t: 'x',
  c: [{ n: '카페', ic: 'cafe', co: 1 }],
  p: [{ i: 'kakao:1', n: '어니언', c: [127.0582, 37.5447], k: 0 }],
  s: '2026-09-29T10:00:00.000Z',
};

describe('pin set share links', () => {
  it('pin set round-trips through #pins= with colors, icons and category paths', async () => {
    const service = new LinkPinShareService(() => 'https://goodroot.app/');
    const url = await service.createShareUrl(set());
    expect(url.startsWith('https://goodroot.app/#pins=')).toBe(true);
    expect(await service.resolveFromUrl(url)).toEqual(set());
    expect(readPinsToken('https://goodroot.app/#share=abc')).toBeNull();
  });

  it('decoder rejects bad shapes, over-long strings, out-of-Korea coordinates and unknown icon/color values', () => {
    expect(decodeSharedPinSet(toToken(wire))).not.toBeNull();
    const bad = (patch: (w: typeof wire) => unknown) => decodeSharedPinSet(toToken(patch(structuredClone(wire))));
    expect(bad((w) => ({ ...w, v: 2 }))).toBeNull();
    expect(bad((w) => ({ ...w, p: [] }))).toBeNull();
    expect(bad((w) => ({ ...w, p: [{ ...w.p[0], c: [139.69, 35.68] }] }))).toBeNull(); // Tokyo
    expect(bad((w) => ({ ...w, p: [{ ...w.p[0], k: 3 }] }))).toBeNull();
    expect(bad((w) => ({ ...w, c: [{ ...w.c[0], ic: '<img>' }] }))).toBeNull();
    expect(bad((w) => ({ ...w, c: [{ ...w.c[0], co: 9 }] }))).toBeNull();
    expect(bad((w) => ({ ...w, c: [{ ...w.c[0], p: 0 }] }))).toBeNull(); // a parent must come earlier
    expect(decodeSharedPinSet('not-base64!')).toBeNull();
    expect(decodeSharedPinSet('a'.repeat(MAX_PINS_TOKEN_LENGTH + 1))).toBeNull();

    const clamped = bad((w) => ({ ...w, t: 'ㅋ'.repeat(500), p: [{ ...w.p[0], n: '가'.repeat(500), m: 'x'.repeat(500) }] }));
    expect(clamped?.title.length).toBe(40);
    expect(clamped?.pins[0].place.name.length).toBe(80);
    expect(clamped?.pins[0].memo?.length).toBe(120);
  });

  it('pin sets over 30 pins or 6000 chars are trimmed (memo, then address) with a notice', () => {
    const many = Array.from({ length: 35 }, (_, i) => ({
      place: { id: `kakao:${i}`, name: `장소 ${i}`, center: [127 + i * 0.001, 37.5] as [number, number], address: '서울 성동구 '.repeat(6) },
      category: 0,
      memo: '메모'.repeat(50),
    }));
    const result = encodeSharedPinSet(set({ pins: many }));
    expect(result.dropped).toBe(5);
    expect(result.trimmed).not.toBe('none');
    expect(result.token.length).toBeLessThanOrEqual(MAX_PINS_TOKEN_LENGTH);
    const decoded = decodeSharedPinSet(result.token);
    expect(decoded?.pins).toHaveLength(30);
    expect(decoded?.pins.every((p) => p.memo === undefined)).toBe(true);
  });
});
