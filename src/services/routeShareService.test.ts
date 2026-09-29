import { describe, expect, it } from 'vitest';
import { samplePlaces, sampleSharedRoute } from '../test/fixtures';
import {
  decodeSharedRoute,
  encodeSharedRoute,
  formatShareText,
  LinkRouteShareService,
  readShareToken,
  SHARE_LIMITS,
} from './routeShareService';

// Hand-built tokens let tests feed shapes the encoder would never produce.
const toToken = (payload: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

describe('share link encoding', () => {
  it('round-trips a route including Korean text and emoji', () => {
    const route = sampleSharedRoute();
    expect(decodeSharedRoute(encodeSharedRoute(route))).toEqual(route);
  });

  it('produces a URL-safe token', () => {
    expect(encodeSharedRoute(sampleSharedRoute())).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('omits empty optional fields', () => {
    const decoded = decodeSharedRoute(encodeSharedRoute(sampleSharedRoute({ note: '   ', sharedBy: '' })));
    expect(decoded?.note).toBeUndefined();
    expect(decoded?.sharedBy).toBeUndefined();
  });

  it('clamps over-long text to the share limits', () => {
    const decoded = decodeSharedRoute(
      encodeSharedRoute(sampleSharedRoute({ title: '가'.repeat(500), note: '나'.repeat(500), sharedBy: '다'.repeat(500) })),
    );
    expect(decoded?.title).toHaveLength(SHARE_LIMITS.title);
    expect(decoded?.note).toHaveLength(SHARE_LIMITS.note);
    expect(decoded?.sharedBy).toHaveLength(SHARE_LIMITS.sharedBy);
  });

  it('falls back to "origin → destination" when the title is missing', () => {
    const token = toToken({
      v: 1,
      o: { i: 'a', n: '서울숲', c: [127.03, 37.54] },
      d: { i: 'b', n: '성수', c: [127.05, 37.54] },
      a: '2026-09-28T00:00:00.000Z',
    });
    expect(decodeSharedRoute(token)?.title).toBe('서울숲 → 성수');
  });
});

describe('share link validation (links come from anyone)', () => {
  const valid = {
    v: 1,
    o: { i: 'a', n: 'A', c: [127, 37] },
    d: { i: 'b', n: 'B', c: [128, 36] },
    t: 't',
    a: '2026-09-28T00:00:00.000Z',
  };

  it.each([
    ['garbage', 'not-base64-json!!'],
    ['empty', ''],
    ['unknown version', toToken({ ...valid, v: 99 })],
    ['same origin and destination', toToken({ ...valid, d: valid.o })],
    ['longitude out of range', toToken({ ...valid, o: { ...valid.o, c: [181, 37] } })],
    ['latitude out of range', toToken({ ...valid, d: { ...valid.d, c: [127, -91] } })],
    ['non-numeric coordinate', toToken({ ...valid, o: { ...valid.o, c: ['127', 37] } })],
    ['missing place name', toToken({ ...valid, o: { i: 'a', c: [127, 37] } })],
    ['oversized token', 'a'.repeat(4001)],
  ])('rejects %s', (_label, token) => {
    expect(decodeSharedRoute(token)).toBeNull();
  });

  it('replaces an invalid timestamp instead of rejecting', () => {
    const decoded = decodeSharedRoute(toToken({ ...valid, a: 'yesterday' }));
    expect(decoded).not.toBeNull();
    expect(Number.isNaN(Date.parse(decoded!.sharedAt))).toBe(false);
  });
});

describe('LinkRouteShareService', () => {
  const service = new LinkRouteShareService(() => 'https://goodroot.app/');

  it('puts the route in the URL fragment only (never the query string)', async () => {
    const url = new URL(await service.createShareUrl(sampleSharedRoute()));
    expect(url.search).toBe('');
    expect(url.hash).toMatch(/^#share=/);
  });

  it('resolves what it created', async () => {
    const route = sampleSharedRoute();
    expect(await service.resolveFromUrl(await service.createShareUrl(route))).toEqual(route);
  });

  it('keeps other hash params alongside the share token', () => {
    expect(readShareToken('https://goodroot.app/#foo=1&share=abc')).toBe('abc');
    expect(readShareToken('https://goodroot.app/#foo=1')).toBeNull();
  });

  it('resolves to null for a URL without a share', async () => {
    expect(await service.resolveFromUrl('https://goodroot.app/')).toBeNull();
  });
});

describe('formatShareText', () => {
  it('includes title, stops, note, author and link', () => {
    const text = formatShareText(sampleSharedRoute(), 'https://goodroot.app/#share=x');
    expect(text.split('\n')).toEqual([
      '🗺️ 성수 데이트 코스',
      `${samplePlaces.onionSeongsu.name} → ${samplePlaces.seoulForest.name}`,
      '📝 카페에서 브런치 먹고 서울숲 산책 🌳',
      '— 지우',
      'https://goodroot.app/#share=x',
    ]);
  });
});
