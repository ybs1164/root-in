import { describe, expect, it } from 'vitest';
import { samplePlaces, sampleSharedRoute } from '../test/fixtures';
import type { SharedCourse } from '../types/course';
import {
  decodeSharedCourse,
  encodeSharedCourse,
  formatCourseShareText,
  LinkCourseShareService,
  MAX_TOKEN_LENGTH,
} from './courseShareService';
import { encodeSharedRoute } from './routeShareService';

// Hand-built tokens let tests feed shapes the encoder would never produce.
const toToken = (payload: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const course = (overrides: Partial<SharedCourse> = {}): SharedCourse => ({
  title: '성수 데이트 코스',
  theme: 'date',
  travelMode: 'walk',
  stops: [
    { place: { ...samplePlaces.onionSeongsu, category: '카페' }, memo: '창가 자리 🌿' },
    { place: samplePlaces.seongsuGalbi },
    { place: samplePlaces.seoulForest, memo: '해 질 녘 산책' },
  ],
  note: '주말 추천',
  sharedBy: '지우',
  sharedAt: '2026-09-28T03:00:00.000Z',
  ...overrides,
});

const stopA = { i: 'a', n: 'A', c: [127, 37] };
const stopB = { i: 'b', n: 'B', c: [127.1, 37] };
const valid = { v: 2, t: 't', h: 'date', x: 'walk', s: [stopA, stopB], a: '2026-09-28T00:00:00.000Z' };

describe('share link v2', () => {
  it('round-trips a 3-stop course with theme, travel mode and per-stop memos', () => {
    const { token, memosTrimmed } = encodeSharedCourse(course());
    expect(memosTrimmed).toBe(false);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeSharedCourse(token)).toEqual(course());
  });

  it('v1 links (origin/destination) still decode, as a 2-stop course', () => {
    const decoded = decodeSharedCourse(encodeSharedRoute(sampleSharedRoute()));
    expect(decoded).toMatchObject({ title: '성수 데이트 코스', sharedBy: '지우', theme: 'trip', travelMode: 'drive' });
    expect(decoded?.stops.map((s) => s.place.id)).toEqual([samplePlaces.onionSeongsu.id, samplePlaces.seoulForest.id]);
  });

  it('accepts a minimal valid payload', () => {
    expect(decodeSharedCourse(toToken(valid))?.stops).toHaveLength(2);
  });

  it.each([
    ['one stop', { ...valid, s: [stopA] }],
    ['eleven stops', { ...valid, s: Array(11).fill(stopA) }],
    ['longitude out of range', { ...valid, s: [{ ...stopA, c: [200, 37] }, stopB] }],
    ['non-numeric coordinate', { ...valid, s: [{ ...stopA, c: ['127', 37] }, stopB] }],
    ['empty name', { ...valid, s: [{ ...stopA, n: '' }, stopB] }],
    ['unknown version', { ...valid, v: 99 }],
  ])('rejects %s', (_label, payload) => {
    expect(decodeSharedCourse(toToken(payload))).toBeNull();
  });

  it('rejects garbage and oversized tokens', () => {
    expect(decodeSharedCourse('garbage!!')).toBeNull();
    expect(decodeSharedCourse('a'.repeat(MAX_TOKEN_LENGTH + 1))).toBeNull();
  });

  it('falls back to safe values for unknown theme / travel mode', () => {
    expect(decodeSharedCourse(toToken({ ...valid, h: 'evil', x: 'rocket' }))).toMatchObject({
      theme: 'etc',
      travelMode: 'walk',
    });
  });

  it('a 10-stop course with long memos stays under the token limit (memos trimmed first)', () => {
    const stops = Array.from({ length: 10 }, (_, i) => ({
      place: {
        id: `kakao:${1000000 + i}`,
        name: `아주 긴 이름의 장소 ${i}번째 지점`,
        center: [127 + i / 100, 37.5] as [number, number],
        category: '카페',
      },
      memo: '메'.repeat(120),
    }));
    const { token, memosTrimmed } = encodeSharedCourse(course({ stops }));
    expect(memosTrimmed).toBe(true);
    expect(token.length).toBeLessThanOrEqual(MAX_TOKEN_LENGTH);
    expect(decodeSharedCourse(token)?.stops).toHaveLength(10);
  });

  it('rounds coordinates to 6 decimals', () => {
    const c = course();
    c.stops[0] = { place: { ...c.stops[0].place, center: [127.123456789, 37.987654321] } };
    expect(decodeSharedCourse(encodeSharedCourse(c).token)?.stops[0].place.center).toEqual([127.123457, 37.987654]);
  });

  it('formatCourseShareText lists stops as "1. … → 2. …"', () => {
    expect(formatCourseShareText(course(), 'https://x/#share=1').split('\n')).toEqual([
      '🗺️ 성수 데이트 코스',
      '1. 어니언 성수 → 2. 성수 갈비집 → 3. 서울숲',
      '📝 주말 추천',
      '— 지우',
      'https://x/#share=1',
    ]);
  });

  it('LinkCourseShareService puts the course in the fragment and resolves it back', async () => {
    const service = new LinkCourseShareService(() => 'https://goodroot.app/');
    const url = await service.createShareUrl(course());
    expect(new URL(url).search).toBe('');
    expect(await service.resolveFromUrl(url)).toEqual(course());
  });
});
