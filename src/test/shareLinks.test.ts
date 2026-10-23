import { describe, expect, it } from 'vitest';
import { decodeSharedCourse } from '../services/courseShareService';
import { decodeSharedDiary } from '../services/diaryShareService';
import { readInviteSlug } from '../services/groupService';
import { decodeSharedPinSet, inKorea } from '../services/pinShareService';
import { decodeSharedRoute, readShareToken } from '../services/routeShareService';
import { readShortSlug } from '../services/shareLinkService';
import { LINK_SAMPLES, SLUG_SAMPLES } from './linkSamples';

// Old links keep opening, and a link from anyone never crashes the app
// (CLAUDE.md 작업 규칙; docs/plan-maintenance-harness.md MH5).

// Encoded here rather than with the app's own helper, so a change to that
// helper would also show up as old links failing.
const tokenOf = (wire: unknown) => Buffer.from(JSON.stringify(wire), 'utf8').toString('base64url');

const decoders = {
  share: decodeSharedCourse,
  pins: decodeSharedPinSet,
  diary: decodeSharedDiary,
} as const;

describe('old share links still open', () => {
  for (const sample of LINK_SAMPLES) {
    it(sample.name, () => {
      const url = `https://root-in.app/#${sample.hash}=${tokenOf(sample.wire)}`;
      const token = new URLSearchParams(new URL(url).hash.slice(1)).get(sample.hash)!;
      const decoded = decoders[sample.hash](token);
      expect(decoded).not.toBeNull();
      expect(decoded).toMatchSnapshot();
    });
  }

  it('a v1 route link is read by the course decoder as a 2-stop course', () => {
    const v1 = LINK_SAMPLES.find((s) => s.name.startsWith('share v1: one'))!;
    const course = decodeSharedCourse(tokenOf(v1.wire))!;
    expect(course.stops.map((s) => s.place.name)).toEqual(['성수 카페', '서울숲']);
    expect(decodeSharedRoute(tokenOf(v1.wire))?.title).toBe('성수 산책');
  });

  it('short links and group invites keep their slugs', () => {
    for (const slug of SLUG_SAMPLES) {
      expect(readShortSlug(`https://root-in.app/#s=${slug}`)).toBe(slug);
      expect(readInviteSlug(`https://root-in.app/#g=${slug}`)).toBe(slug);
    }
  });
});

// ── fuzz: links come from anyone ──

/** Small seeded PRNG (mulberry32) so a failure is reproducible. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEIRD: unknown[] = [
  null,
  undefined,
  0,
  -1,
  1e308,
  Number.NaN,
  Infinity,
  '',
  ' ',
  'x'.repeat(5000),
  '\u0000￿\ud800',
  '<script>alert(1)</script>',
  [],
  [1],
  [999, 999],
  [127, 37, 0],
  {},
  { v: 2 },
  true,
  '__proto__',
];

/** `value` with one random field deep inside dropped, retyped or replaced. */
function mutate(value: unknown, random: () => number, depth = 0): unknown {
  const pick = <T,>(xs: T[]) => xs[Math.floor(random() * xs.length)];
  if (depth > 0 && random() < 0.25) return pick(WEIRD);
  if (Array.isArray(value)) {
    if (value.length && random() < 0.6) {
      const copy = [...value];
      const i = Math.floor(random() * copy.length);
      copy[i] = mutate(copy[i], random, depth + 1);
      return copy;
    }
    return random() < 0.5 ? value.slice(0, Math.floor(random() * value.length)) : [...value, ...value, ...value];
  }
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    const keys = Object.keys(copy);
    const key = pick(keys);
    const roll = random();
    if (roll < 0.2) delete copy[key];
    else if (roll < 0.3) copy[pick(['zz', '__proto__', 'constructor'])] = pick(WEIRD);
    else copy[key] = mutate(copy[key], random, depth + 1);
    return copy;
  }
  return pick(WEIRD);
}

function randomText(random: () => number): string {
  const chars = 'ABCabc019-_+/=%#&?.가힣\u0000';
  return Array.from({ length: Math.floor(random() * 120) }, () => chars[Math.floor(random() * chars.length)]).join('');
}

/** Coordinates and names of whatever a decoder accepted. */
function placesIn(decoded: unknown): { name: string; center: [number, number] }[] {
  if (!decoded || typeof decoded !== 'object') return [];
  const d = decoded as Record<string, unknown>;
  const fromStops = (Array.isArray(d.stops) ? d.stops : Array.isArray(d.pins) ? d.pins : []).map(
    (s) => (s as { place: { name: string; center: [number, number] } }).place,
  );
  return fromStops;
}

describe('decoders never throw on hostile links', () => {
  const random = rng(20261023);
  const RUNS = 400;

  for (const [hash, decode] of Object.entries(decoders)) {
    it(`#${hash}= rejects or cleans what it is given`, () => {
      const samples = LINK_SAMPLES.filter((s) => s.hash === hash);
      for (let run = 0; run < RUNS; run++) {
        const input =
          run % 4 === 0 ? randomText(random) : tokenOf(mutate(samples[run % samples.length].wire, random));
        let decoded: unknown;
        expect(() => (decoded = decode(input)), `input ${input.slice(0, 80)}`).not.toThrow();
        for (const place of placesIn(decoded)) {
          expect(place.name.length).toBeLessThanOrEqual(80);
          const [lon, lat] = place.center;
          expect(Number.isFinite(lon) && Number.isFinite(lat)).toBe(true);
          if (hash === 'pins') expect(inKorea([lon, lat])).toBe(true);
          else expect(Math.abs(lon) <= 180 && Math.abs(lat) <= 90).toBe(true);
        }
      }
    });
  }

  it('link readers return null for broken URLs instead of throwing', () => {
    for (let run = 0; run < RUNS; run++) {
      const url = run % 2 ? `https://root-in.app/#${randomText(random)}` : randomText(random);
      for (const read of [readShortSlug, readInviteSlug]) expect(() => read(url)).not.toThrow();
      // readShareToken is only handed the page's own href, which always parses.
      if (url.startsWith('https://')) expect(() => readShareToken(url)).not.toThrow();
    }
  });
});
