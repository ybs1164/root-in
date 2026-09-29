import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import type { SharedDiary } from '../types/diary';
import { encodeSharedCourse } from './courseShareService';
import {
  decodeSharedDiary,
  encodeSharedDiary,
  formatDiaryShareText,
  LinkDiaryShareService,
  MAX_DIARY_TOKEN_LENGTH,
} from './diaryShareService';

const toToken = (payload: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const diary = (overrides: Partial<SharedDiary> = {}): SharedDiary => ({
  date: '2026-09-28',
  title: '성수에서 보낸 하루',
  mood: 'great',
  travelMode: 'walk',
  stops: [
    { place: { ...samplePlaces.onionSeongsu, category: '카페' }, time: '10:30', memo: '브런치' },
    { place: samplePlaces.seongsuGalbi, time: '13:00' },
    { place: samplePlaces.seoulForest },
  ],
  text: '날씨가 좋아서 오래 걸었다.',
  sharedBy: '지우',
  sharedAt: '2026-09-28T09:00:00.000Z',
  ...overrides,
});

const stop = { i: 'a', n: 'b', c: [127, 37] };

describe('diary share links', () => {
  it('round-trips a day with times, memos, mood and text', () => {
    expect(decodeSharedDiary(encodeSharedDiary(diary()).token)).toEqual(diary());
  });

  it('leaves the diary text out when not included', () => {
    const decoded = decodeSharedDiary(encodeSharedDiary(diary(), { includeText: false }).token);
    expect(decoded?.text).toBeUndefined();
    expect(decoded?.stops[0].memo).toBe('브런치');
  });

  it('drops text, then memos, to stay under the length limit', () => {
    const stops = Array.from({ length: 15 }, (_, i) => ({
      place: { ...samplePlaces.seoulForest, id: `kakao:${i}`, name: '아주 긴 장소 이름'.repeat(5) },
      memo: '메모'.repeat(60),
      time: '10:00',
    }));
    const result = encodeSharedDiary(diary({ stops, text: '일기'.repeat(500) }));
    expect(result.token.length).toBeLessThanOrEqual(MAX_DIARY_TOKEN_LENGTH);
    expect(result.trimmed).not.toBe('none');
    const decoded = decodeSharedDiary(result.token);
    expect(decoded?.text).toBeUndefined();
    expect(decoded?.stops).toHaveLength(15);
  });

  it('rejects malformed payloads, bad dates and bad coordinates', () => {
    expect(decodeSharedDiary('not-base64!!')).toBeNull();
    expect(decodeSharedDiary(toToken({ v: 1, d: '2026-13-01', x: 'walk', s: [stop], a: '' }))).toBeNull();
    expect(decodeSharedDiary(toToken({ v: 1, d: '2026-09-28', x: 'walk', s: [], a: '' }))).toBeNull();
    expect(decodeSharedDiary(toToken({ v: 1, d: '2026-09-28', x: 'walk', s: [{ ...stop, c: [500, 37] }], a: '' }))).toBeNull();
    expect(decodeSharedDiary(toToken({ v: 2, d: '2026-09-28', s: [stop] }))).toBeNull();
  });

  it('clamps strings and ignores unknown mood, mode and time values', () => {
    const decoded = decodeSharedDiary(
      toToken({
        v: 1,
        d: '2026-09-28',
        t: 'T'.repeat(500),
        o: 'ecstatic',
        x: 'teleport',
        s: [{ ...stop, t: '99:99', m: 'm'.repeat(999) }],
        w: 'w'.repeat(1500),
        a: 'yesterday',
      }),
    );
    expect(decoded?.title).toHaveLength(80);
    expect(decoded?.mood).toBeUndefined();
    expect(decoded?.travelMode).toBe('walk');
    expect(decoded?.stops[0].time).toBeUndefined();
    expect(decoded?.stops[0].memo).toHaveLength(120);
    expect(decoded?.text).toHaveLength(1000);
    expect(Number.isNaN(Date.parse(decoded!.sharedAt))).toBe(false);
  });

  it('uses its own #diary= key, so course links are never read as diaries', async () => {
    const service = new LinkDiaryShareService(() => 'https://goodroot.test/');
    const url = await service.createShareUrl(diary());
    expect(url.startsWith('https://goodroot.test/#diary=')).toBe(true);
    expect(await service.resolveFromUrl(url)).toEqual(diary());

    const courseToken = encodeSharedCourse({ ...diary(), theme: 'date' }).token;
    expect(await service.resolveFromUrl(`https://goodroot.test/#share=${courseToken}`)).toBeNull();
    expect(decodeSharedDiary(courseToken)).toBeNull();
  });

  it('formats a share text with visit times', () => {
    expect(formatDiaryShareText(diary(), 'https://x')).toContain('1. 10:30 어니언 성수 → 2. 13:00 성수 갈비집 → 3. 서울숲');
  });
});
