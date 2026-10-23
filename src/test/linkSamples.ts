// Share link payloads as each format has been sent, kept frozen so a change to
// a decoder can't stop old links opening (CLAUDE.md: 공유 링크 포맷을 바꿀 때
// 이전 버전 링크는 계속 열려야 한다; docs/plan-maintenance-harness.md MH5).
//
// Kept as the readable wire JSON; the test base64url-encodes it itself. When a
// format changes, ADD a sample for the new shape — never edit an old one.

export interface LinkSample {
  name: string;
  /** The fragment key the link travels under. */
  hash: 'share' | 'pins' | 'diary';
  wire: unknown;
}

const seongsu = { i: 'kakao:1001', n: '성수 카페', c: [127.0557, 37.5446] };
const seoulForest = { i: 'kakao:1002', n: '서울숲', c: [127.0374, 37.5443] };
const ttukseom = { i: 'osm:node/42', n: '뚝섬 한강공원', c: [127.0666, 37.5291] };

export const LINK_SAMPLES: LinkSample[] = [
  // ── #share= (routes / courses) ──
  {
    name: 'share v1: one origin → destination route',
    hash: 'share',
    wire: { v: 1, o: seongsu, d: seoulForest, t: '성수 산책', m: '오후에 가요', b: '민지', a: '2026-09-20T05:00:00.000Z' },
  },
  {
    name: 'share v1: no title (falls back to "A → B")',
    hash: 'share',
    wire: { v: 1, o: seongsu, d: seoulForest, a: '2026-09-20T05:00:00.000Z' },
  },
  {
    name: 'share v2: oldest stops (no place kind, no memo)',
    hash: 'share',
    wire: { v: 2, t: '주말 코스', h: 'date', x: 'walk', s: [seongsu, seoulForest], a: '2026-09-28T03:00:00.000Z' },
  },
  {
    name: 'share v2: category, place kind, memo, note, sender',
    hash: 'share',
    wire: {
      v: 2,
      t: 'IN MY ROOT #2',
      h: 'etc',
      x: 'walk',
      s: [
        { ...seongsu, k: 'cafe', y: 'cafe', m: '창가 자리' },
        { ...seoulForest, y: 'park' },
        { ...ttukseom, k: '한강' },
      ],
      m: '천천히 걸어요',
      b: '익명의 여행자',
      a: '2026-10-07T09:30:00.000Z',
    },
  },

  // ── #pins= (pin sets; links still decode though the receiving screen is gone) ──
  {
    name: 'pins v1: sub-category parent index p (ignored since 2026-10-04)',
    hash: 'pins',
    wire: {
      v: 1,
      c: [
        { n: '카페', ic: 'cafe', co: 3 },
        { n: '디저트', ic: 'food', co: 2, p: 0 },
      ],
      p: [
        { ...seongsu, k: 0, a: '서울 성동구 성수동2가', m: '라떼' },
        { ...seoulForest, k: 1, y: 'park' },
      ],
      s: '2026-10-01T01:00:00.000Z',
      b: '민지',
    },
  },
  {
    name: 'pins v1: wheel-picked category colour',
    hash: 'pins',
    wire: { v: 1, c: [{ n: '산책', ic: 'pin', co: '#a1b2c3' }], p: [{ ...ttukseom, k: 0 }], s: '2026-10-05T01:00:00.000Z' },
  },

  // ── #diary= (days; no receiving screen right now — docs/todo.md) ──
  {
    name: 'diary v1: a recorded day with times, mood and text',
    hash: 'diary',
    wire: {
      v: 1,
      d: '2026-10-03',
      t: '성수 하루',
      o: 'good',
      x: 'walk',
      s: [
        { ...seongsu, t: '11:20', m: '브런치' },
        { ...seoulForest, t: '14:05' },
      ],
      w: '날씨가 좋았다.',
      b: '민지',
      a: '2026-10-03T12:00:00.000Z',
    },
  },
  {
    name: 'diary v1: a planned day (p: 1, added after v1 shipped)',
    hash: 'diary',
    wire: { v: 1, d: '2026-10-10', p: 1, t: '다음 주', x: 'walk', s: [seongsu, ttukseom], a: '2026-10-04T12:00:00.000Z' },
  },
];

/** Short-link slugs as the server has handed them out (#s=, #g=). */
export const SLUG_SAMPLES = ['Ab3dE9xYz0', 'q1W2e3', 'a_b-c_d-e_f-g_h1'];
