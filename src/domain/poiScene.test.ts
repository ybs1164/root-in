import { describe, expect, it } from 'vitest';
import type { MapViewport } from './districtMap';
import { buildPlaceProfile, declutter, EMPTY_PROFILE, inScene, labelWidth, placeBoxes, screenPoint, selectScene, type SceneCandidate } from './poiScene';
import type { PlaceRef } from '../types/course';
import type { Pin } from '../types/pin';
import type { StoredPing } from './dayPings';
import type { Course } from '../types/course';
import { stickerBelow } from './poiAppearance';
import { APPROVED_POI_STICKERS } from './poiStickerKinds';

const view: MapViewport = { bounds: { west: 127, south: 37, east: 127.01, north: 37.01 }, widthPx: 400 };
const place = (id: string, kind: PlaceRef['kind'], lon: number, lat: number, name = id): PlaceRef => ({ id, name, kind, center: [lon, lat] });
const c = (p: PlaceRef, fame = 0): SceneCandidate => ({ place: p, fame });
const names = (places: PlaceRef[]) => places.map((p) => p.id).sort();

describe('one place per kind on a screen', () => {
  it('never shows two stickers of one kind, and the better known one wins', () => {
    const scene = selectScene([
      c(place('cafe-a', 'cafe', 127.001, 37.001), 0.1), c(place('cafe-b', 'cafe', 127.008, 37.008), 0.3),
      c(place('bank', 'bank', 127.005, 37.002)), c(place('park', 'park', 127.002, 37.008)),
    ], view);
    expect(names(scene)).toEqual(['bank', 'cafe-b', 'park']);
  });

  // view: 0.01° over 400px → 2.5e-5° a pixel at the equator scale used by screenPoint.
  const px = 0.01 / 400;
  it('lays out a sticker over its name, like the marker CSS', () => {
    const [art, name] = placeBoxes(place('cafe', 'cafe', 127, 37, '카페'), 0, 0);
    // The cafe cup's visible outline, not the whole 48px square.
    expect(art.right - art.left).toBeCloseTo(24.6 + 22.5);
    expect(name.right - name.left).toBeCloseTo(labelWidth('카페', 10));
    expect(placeBoxes(place('long', 'cafe', 127, 37, '아주아주아주긴카페이름입니다요'), 0, 0)[1].right).toBe(35);
    // No artwork for the kind: the name alone.
    expect(placeBoxes(place('x', undefined, 127, 37, '이름'), 0, 0)).toHaveLength(1);
  });

  it('puts the name under art that reaches past its square, and counts that art', () => {
    const [stop, stopName] = placeBoxes(place('bus', 'bus_stop', 127, 37, '정류장'), 0, 0);
    expect(stickerBelow('bus_stop')).toBeGreaterThan(0);
    expect(stopName.top).toBeGreaterThanOrEqual(stop.bottom);
    // Nothing ever reaches its own name.
    for (const kind of APPROVED_POI_STICKERS) {
      const [a, n] = placeBoxes(place(kind, kind, 127, 37, '이름'), 0, 0);
      expect(n.top, kind).toBeGreaterThanOrEqual(a.bottom);
    }
  });

  it('leaves out a place whose sticker or name would touch a better one', () => {
    const at = (dxPx: number, dyPx: number) => [127.005 + dxPx * px, 37.005 + dyPx * px] as const;
    const best = c(place('bank', 'bank', ...at(0, 0), '아주긴이름의은행'), 0.5);
    // Stickers 52px apart don't touch, but these 70px names do.
    const nameClash = c(place('cafe', 'cafe', ...at(52, 0), '아주긴이름의카페'), 0.1);
    expect(names(selectScene([best, nameClash], view))).toEqual(['bank']);
    // The same place, short-named: its 20px name clears the bank's.
    const short = c(place('cafe', 'cafe', ...at(52, 0), '카페'), 0.1);
    expect(names(selectScene([best, short], view))).toEqual(['bank', 'cafe']);
    // A name under the sticker above it.
    const below = c(place('park', 'park', ...at(0, 40), '공원'), 0.1);
    expect(names(selectScene([best, below], view))).toEqual(['bank']);
    expect(names(selectScene([best, c(place('park', 'park', ...at(0, 80), '공원'), 0.1)], view))).toEqual(['bank', 'park']);
  });

  it('never draws a place over one of the user’s pins, nor repeats a pin’s kind', () => {
    const cafe = c(place('cafe', 'cafe', 127.005, 37.005, '카페'), 0.9);
    const pin = (dxPx: number, kind: PlaceRef['kind'] = 'bank') => place('pin', kind, 127.005 + dxPx * px, 37.005, '내 핀');
    expect(names(selectScene([cafe], view, EMPTY_PROFILE, new Set(), [pin(30)]))).toEqual([]);
    // Even one already on screen gives way.
    expect(names(selectScene([cafe], view, EMPTY_PROFILE, new Set(['cafe']), [pin(0)]))).toEqual([]);
    expect(names(selectScene([cafe], view, EMPTY_PROFILE, new Set(), [pin(80)]))).toEqual(['cafe']);
    // A cafe pin on this screen: no second cafe sticker, wherever it is.
    expect(names(selectScene([cafe], view, EMPTY_PROFILE, new Set(), [pin(150, 'cafe')]))).toEqual([]);
    // Off screen, it takes nothing.
    expect(names(selectScene([cafe], view, EMPTY_PROFILE, new Set(), [place('far', 'cafe', 127.5, 37.5)]))).toEqual(['cafe']);
  });

  it('keeps the better of two crowded places, whichever kind', () => {
    const scene = selectScene([c(place('cafe', 'cafe', 127.0040, 37.0050), 0.1), c(place('bank', 'bank', 127.0041, 37.0051), 0.2)], view);
    expect(names(scene)).toEqual(['bank']);
  });

  it('finds screen positions on a turned map, with markers kept upright', () => {
    const turned: MapViewport = { bounds: { west: 126.99, south: 36.99, east: 127.01, north: 37.01 }, widthPx: 400,
      worldDegreesPerPixel: px, screen: { width: 400, height: 400, bearing: 90 } };
    // Facing east, a place to the east is straight up the screen.
    const east = screenPoint([127.001, 37], turned);
    expect(east.x).toBeCloseTo(0, 0);
    expect(east.y).toBeLessThan(-30);
    // Two places one above the other on the map sit side by side on screen, and clash.
    const a = place('a', 'cafe', 127, 37, '카페'), b = place('b', 'bank', 127, 37 + 30 * px, '은행');
    expect(declutter([a, b], turned).map((p) => p.id)).toEqual(['a']);
  });

  it('chooses the same places whatever order the data came in', () => {
    const list = Array.from({ length: 200 }, (_, i) => c(place(`p${i}`, (['cafe', 'bank', 'park', 'bar'] as const)[i % 4],
      127 + (i % 20) * 0.0005, 37 + Math.floor(i / 20) * 0.001)));
    expect(selectScene([...list].reverse(), view)).toEqual(selectScene(list, view));
    const kinds = selectScene(list, view).map((p) => p.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('counts only what is on screen, including a turned screen', () => {
    expect(selectScene([c(place('far', 'cafe', 127.02, 37.005))], view)).toEqual([]);
    const turned: MapViewport = { bounds: { west: 126.99, south: 36.99, east: 127.01, north: 37.01 }, widthPx: 400,
      worldDegreesPerPixel: 0.01 / 400, screen: { width: 400, height: 400, bearing: 45 } };
    expect(inScene([127, 37], turned)).toBe(true);
    // The box corner lies off a 45° screen.
    expect(inScene([127.0095, 37.0095], turned)).toBe(false);
  });

  it('keeps what is on screen when the map moves, even if a better one comes into view', () => {
    const shown = place('cafe-a', 'cafe', 127.004, 37.004);
    const better = c(place('cafe-b', 'cafe', 127.009, 37.009), 0.9);
    expect(names(selectScene([c(shown), better], view))).toEqual(['cafe-b']);
    expect(names(selectScene([c(shown), better], view, EMPTY_PROFILE, new Set(['cafe-a'])))).toEqual(['cafe-a']);
  });

  it('lets places the user went to beat better known ones of the same kind', () => {
    const chain = c(place('chain', 'cafe', 127.002, 37.002, '체인카페'), 0.3);
    const local = c(place('local', 'cafe', 127.008, 37.008, '골목카페'));
    const profile = { kinds: {}, spots: [{ x: 12700801, y: 3700801, name: '골목카페' }] };
    expect(names(selectScene([chain, local], view))).toEqual(['chain']);
    expect(names(selectScene([chain, local], view, profile))).toEqual(['local']);
  });

  it('lets the kinds the user likes claim a crowded cell first', () => {
    const cafe = c(place('cafe', 'cafe', 127.0040, 37.0050));
    const bank = c(place('bank', 'bank', 127.0041, 37.0051), 0.1);
    expect(names(selectScene([cafe, bank], view))).toEqual(['bank']);
    expect(names(selectScene([cafe, bank], view, { kinds: { cafe: 0.6 }, spots: [] }))).toEqual(['cafe']);
  });
});

describe('the profile from the user’s own data', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const pin = (id: string, kind: PlaceRef['kind'], at: string, name = id): Pin => ({
    id, userId: 'me', categoryId: 'none', createdAt: at, place: place(`k:${id}`, kind, 127.004, 37.004, name),
  });
  it('weighs pins, pings and route stops by kind, fading with age', () => {
    const pins = [pin('a', 'cafe', '2026-11-01T00:00:00Z'), pin('b', 'bar', '2025-11-01T00:00:00Z')];
    const pings: StoredPing[] = [{ id: 'p', pinId: 'a', day: '2026-11-03', at: '2026-11-03T10:00:00Z', name: '카페', center: [127.005, 37.005] }];
    const courses = [{ id: 'c', userId: 'me', title: 'r', theme: 'etc', travelMode: 'walk', createdAt: '2026-11-02T00:00:00Z',
      stops: [{ place: place('s', 'bakery', 127.006, 37.006, '빵집') }] }] as unknown as Course[];
    const profile = buildPlaceProfile({ pins, pings, courses }, now);
    expect(profile.kinds.cafe).toBeGreaterThan(profile.kinds.bakery);
    expect(profile.kinds.bakery).toBeGreaterThan(profile.kinds.bar);
    expect(profile.kinds.cafe).toBeLessThan(1);
    expect(profile.spots.map((s) => s.name)).toContain('빵집');
  });
  it('leaves out pings near the user’s excluded addresses', () => {
    const pings: StoredPing[] = [{ id: 'p', day: '2026-11-03', at: '2026-11-03T10:00:00Z', name: '우리집앞', center: [127.005, 37.005], local: true }];
    expect(buildPlaceProfile({ pings }, now)).toEqual(EMPTY_PROFILE);
  });
});
