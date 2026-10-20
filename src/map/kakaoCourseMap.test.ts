import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AreaShapes } from '../domain/adminAreas';
import type { Ring } from '../domain/districtMap';
import type { KakaoMapsNamespace } from '../lib/kakaoSdk';
import { KakaoCourseMap } from './kakaoCourseMap';
import { KAKAO_LIMITS } from './mapStyle';

interface Shape {
  kind: 'polygon' | 'polyline';
  options: Record<string, unknown>;
  shown: boolean;
}

/** A fake Kakao SDK that records every polygon and polyline (no SDK in tests). */
function fakeKakao() {
  const shapes: Shape[] = [];
  // A function, not an arrow: the map calls it with `new`.
  const latLng = function (lat: number, lng: number) { return { getLat: () => lat, getLng: () => lng }; };
  const shape = (kind: Shape['kind']) =>
    function (this: unknown, options: Record<string, unknown>) {
      const made: Shape = { kind, options: { ...options }, shown: true };
      shapes.push(made);
      return {
        setMap: (map: unknown) => { made.shown = map !== null; },
        setPath: (path: unknown) => { made.options.path = path; },
        setOptions: (more: Record<string, unknown>) => Object.assign(made.options, more),
        setPosition: vi.fn(),
      };
    };
  const map = {
    // A screen 400px wide over 0.04° at 37°N: about 9 m/px.
    getBounds: () => ({ getSouthWest: () => latLng(37, 127), getNorthEast: () => latLng(37.03, 127.04) }),
    getCenter: () => latLng(37.015, 127.02),
    getLevel: () => 5,
  };
  const maps = {
    LatLng: latLng,
    Map: function () { return map; },
    Polygon: shape('polygon'),
    Polyline: shape('polyline'),
    CustomOverlay: shape('polygon'),
    Point: function () { return {}; },
    event: { addListener: vi.fn() },
  } as unknown as KakaoMapsNamespace;
  // Tests run without a DOM: just what the map touches (listeners, the credit line).
  vi.stubGlobal('document', { createElement: () => ({ remove: vi.fn() }) });
  const container = { clientWidth: 400, addEventListener: vi.fn(), removeEventListener: vi.fn(), appendChild: vi.fn() } as unknown as HTMLElement;
  return { kakao: new KakaoCourseMap(maps, container, { center: [127.02, 37.015] }), shapes };
}

const ring = (x: number, size = 0.01): Ring => [[x, 37], [x + size, 37], [x + size, 37 + size], [x, 37 + size], [x, 37]];
const areas: AreaShapes = { parts: [[ring(127)]], others: [[ring(127.02)], [ring(127.03)]] };
const withBase = (roads = 3): AreaShapes => ({
  ...areas,
  base: {
    land: [[ring(126.9, 0.3)]],
    parks: [[ring(127.01)]],
    roads: Array.from({ length: roads }, (_, i) => ({ tier: (i % 2 ? 1 : 3) as 1 | 3, path: [[127, 37 + i * 0.001], [127.03, 37 + i * 0.001]] as [number, number][] })),
  },
});
const zOf = (s: Shape) => s.options.zIndex as number;

afterEach(() => vi.unstubAllGlobals());

describe('Kakao map', () => {
  it('covers the tiles with land until the base map comes, then with water under its land', () => {
    const { kakao, shapes } = fakeKakao();
    kakao.setAreaMap(areas);
    const cover = shapes[0];
    const landColour = cover.options.fillColor;
    expect(zOf(cover)).toBe(0);
    kakao.setAreaMap(withBase());
    expect(cover.options.fillColor).not.toBe(landColour);
    // No polygons for the neighbouring areas: they are just land.
    expect(shapes.filter((s) => s.kind === 'polygon' && s.shown)).toHaveLength(1 + 1 + 1 + 1);
  });

  it('stacks land, the 동 tint, parks, trunk edges and roads in that order', () => {
    const { kakao, shapes } = fakeKakao();
    kakao.setAreaMap(withBase());
    const [cover, land, park, tint] = [0, 1, 2, 3].map((i) => shapes.filter((s) => s.kind === 'polygon')[i]);
    expect(zOf(cover)).toBeLessThan(zOf(land));
    expect(zOf(land)).toBeLessThan(zOf(tint));
    expect(zOf(tint)).toBeLessThan(zOf(park));
    const lines = shapes.filter((s) => s.kind === 'polyline');
    const edges = lines.filter((l) => l.options.strokeWeight === Math.max(...lines.map((x) => x.options.strokeWeight as number)));
    expect(edges.length).toBeGreaterThan(0);
    expect(Math.min(...lines.map(zOf))).toBeGreaterThan(zOf(park));
    // The tint is see-through.
    expect(tint.options.fillOpacity).toBeLessThan(1);
  });

  it('draws at most the Kakao limits, reuses its objects and removes the extra ones', () => {
    const { kakao, shapes } = fakeKakao();
    kakao.setAreaMap(withBase(KAKAO_LIMITS.roads + 50));
    const shown = () => shapes.filter((s) => s.kind === 'polyline' && s.shown);
    // Roads plus the edges under the trunk roads among them.
    expect(shown().length).toBeLessThanOrEqual(KAKAO_LIMITS.roads * 2);
    const made = shapes.length;
    kakao.setAreaMap(withBase(4));
    expect(shapes.length).toBe(made);
    expect(shown()).toHaveLength(4 + 2);
  });

  it('fades the tint for a route and clears everything when the areas go', () => {
    const { kakao, shapes } = fakeKakao();
    kakao.setAreaMap(withBase());
    const tint = shapes.filter((s) => s.kind === 'polygon')[3];
    kakao.setAreaTint(false);
    expect(tint.options.fillOpacity).toBe(0);
    kakao.setAreaMap(null);
    expect(shapes.filter((s) => s.kind !== 'polygon' || s.shown).filter((s) => s.shown)).toHaveLength(0);
  });
});
