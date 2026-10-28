import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AreaShapes } from '../domain/adminAreas';
import type { Ring } from '../domain/districtMap';
import type { KakaoMapsNamespace } from '../lib/kakaoSdk';
import { KakaoCourseMap } from './kakaoCourseMap';
import { KAKAO_LAND_LIMIT, SHADOW } from './mapStyle';

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
/** The shapes with a base map of `count` land polygons (each smaller than the last). */
const withBase = (count = 1): AreaShapes => ({
  ...areas,
  base: { land: Array.from({ length: count }, (_, i) => [ring(126.9 + i * 0.001, 0.3 / (i + 1))]) },
});
const zOf = (s: Shape) => s.options.zIndex as number;
const polygons = (shapes: Shape[]) => shapes.filter((s) => s.kind === 'polygon');

afterEach(() => vi.unstubAllGlobals());

describe('Kakao map', () => {
  it('draws parks and streets, reuses them on a pan, and clears them on teardown', () => {
    const { kakao, shapes } = fakeKakao();
    const detail = { ...withBase(), base: { land: [[ring(127)]], parks: [[ring(127.01)]], roads: [{ path: ring(127.02), width: 4, tier: 4 }] } };
    kakao.setAreaMap(detail);
    const street = shapes.find((s) => s.kind === 'polyline')!;
    expect(street.options.strokeWeight).toBe(4);
    const park = shapes.find((s) => s.options.fillColor && s.options.zIndex === Number(street.options.zIndex) - 1);
    expect(park).toBeDefined();
    const made = shapes.length;
    kakao.setAreaMap({ ...detail, base: { ...detail.base, roads: [{ path: ring(127.03), width: 6, tier: 4 }] } });
    expect(shapes).toHaveLength(made);
    expect(street.options.strokeWeight).toBe(6);
    kakao.setAreaMap(null);
    expect(shapes.every((s) => !s.shown)).toBe(true);
  });
  it('covers the tiles with land until the base map comes, then with water under its land', () => {
    const { kakao, shapes } = fakeKakao();
    kakao.setAreaMap(areas);
    const cover = shapes[0];
    const landColour = cover.options.fillColor;
    expect(zOf(cover)).toBe(0);
    kakao.setAreaMap(withBase());
    expect(cover.options.fillColor).not.toBe(landColour);
    // Cover, land and the 동 tint: no polygons for the neighbouring areas, no parks, no roads.
    expect(polygons(shapes).filter((s) => s.shown)).toHaveLength(3);
    expect(shapes.filter((s) => s.kind === 'polyline')).toHaveLength(0);
  });

  it('stacks the cover, the land and the see-through 동 tint in that order', () => {
    const { kakao, shapes } = fakeKakao();
    kakao.setAreaMap(withBase());
    const [cover, land, tint] = polygons(shapes);
    expect(zOf(cover)).toBeLessThan(zOf(land));
    expect(zOf(land)).toBeLessThan(zOf(tint));
    expect(tint.options.fillOpacity).toBeLessThan(1);
  });

  it('draws at most the land limit, reuses its objects and removes the extra ones', () => {
    const { kakao, shapes } = fakeKakao();
    kakao.setAreaMap(withBase(KAKAO_LAND_LIMIT + 50));
    // Cover + capped land + tint.
    expect(polygons(shapes).filter((s) => s.shown)).toHaveLength(1 + KAKAO_LAND_LIMIT + 1);
    const made = shapes.length;
    kakao.setAreaMap(withBase(4));
    expect(shapes.length).toBe(made);
    expect(polygons(shapes).filter((s) => s.shown)).toHaveLength(1 + 4 + 1);
  });

  it('fades the tint for a route and clears everything when the areas go', () => {
    const { kakao, shapes } = fakeKakao();
    kakao.setAreaMap(withBase());
    const tint = polygons(shapes)[2];
    kakao.setAreaTint(false);
    expect(tint.options.fillOpacity).toBe(0);
    kakao.setAreaMap(null);
    expect(polygons(shapes).filter((s) => s.shown)).toHaveLength(0);
  });

  it('tints each part in its tone over a soft shadow, with no outlines, both off under a route', () => {
    const { kakao, shapes } = fakeKakao();
    kakao.setAreaMap({ ...withBase(), parts: [[ring(127)], [ring(127.012)]], partTones: [0, 2], partsOutline: [[ring(127, 0.022)]], partsDrop: [[ring(127.001)]] });
    const [cover, land, shadow, tintA, tintB, extra] = polygons(shapes);
    expect(zOf(land)).toBeLessThan(zOf(shadow));
    expect(zOf(shadow)).toBeLessThan(zOf(tintA));
    expect(extra).toBeUndefined();
    // The shadow is already cut to the outside: drawn as is.
    expect(shadow.options.fillOpacity).toBe(SHADOW.opacity);
    expect(zOf(cover)).toBe(0);
    kakao.setAreaTint(false);
    expect([shadow, tintA, tintB].map((s) => s.options.fillOpacity)).toEqual([0, 0, 0]);
  });
});
