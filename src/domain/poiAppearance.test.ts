import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parsePlaceArea, poiAppearance, poiStickerUrl } from './poiAppearance';
import { APPROVED_POI_STICKERS } from './poiStickerKinds';
import { parseLandmarks } from './landmarkPlaces';
import { parseKindShops } from '../services/placeKindService';
import { selectNearbyPlaces } from './nearbyPlaces';

const place = { id: 'landmark:r123', name: '학교', center: [127, 37] as [number, number], kind: 'school' as const };

describe('approved map stickers', () => {
  it('ships all 103 final stickers, using cash instead of ATM artwork', () => {
    const manifest = JSON.parse(readFileSync('public/poi-stickers/manifest.json', 'utf8'));
    expect(APPROVED_POI_STICKERS).toHaveLength(103);
    expect(Object.keys(manifest.assets).sort()).toEqual([...APPROVED_POI_STICKERS].sort());
    expect(readdirSync('public/poi-stickers').filter((p) => p.endsWith('.png'))).toHaveLength(103);
    expect(manifest.assets.bank.reviewId).toBe('bank_cash');
    expect(readFileSync('public/poi-stickers/bank.png')).toEqual(readFileSync(manifest.assets.bank.source));
    expect(manifest.assets.dessert.source).toContain('dessert-fresh.png');
    for (const kind of ['police', 'fire_station', 'government', 'building'] as const) expect(poiStickerUrl(kind)).toContain(`${kind}.png`);
    for (const id of APPROVED_POI_STICKERS) expect(existsSync(`public/poi-stickers/${id}.png`)).toBe(true);
    for (const kind of ['shop', 'grocery', 'garden', 'airport', 'cafe', 'restaurant'] as const) expect(poiStickerUrl(kind)).toMatch(/poi-stickers\/.*\.png$/);
    expect(poiStickerUrl('school')).toMatch(/poi-stickers\/school.png$/);
    expect(poiStickerUrl(undefined)).toBeNull();
  });

  it('uses one size regardless of place area or identity', () => {
    for (const extra of [{}, { areaM2: 100 }, { landAreaM2: 10000 }, { areaM2: 1e100 }, { id: 'another' }]) {
      expect(poiAppearance({ ...place, ...extra })).toMatchObject({ size: 48, source: 'uniform', rotation: 0 });
    }
    expect(parsePlaceArea({ areaM2: NaN, landAreaM2: -1 })).toEqual({});
    expect(poiAppearance({ ...place, kind: undefined }).sticker).toBeNull();
  });

  it('carries optional area metadata through both static data sources and shop selection', () => {
    const landmark = parseLandmarks({ v: 1, r: [['r1', '학교', 12700000, 3700000, 'school', '학교', 1, { areaM2: 900 }]] })![0];
    expect(landmark.areaM2).toBe(900);
    const shops = parseKindShops({ v: 1, k: ['pizza'], r: [['피자', 12700400, 3700500, 0, { landAreaM2: 1600 }]] })!;
    const selected = selectNearbyPlaces(shops, { bounds: { west: 127, south: 37, east: 127.01, north: 37.01 }, widthPx: 400 });
    expect(selected[0].landAreaM2).toBe(1600);
  });

  it('separates public facilities in existing landmark tiles without reclassifying ordinary buildings', () => {
    const names = ['서울경찰청 제1기동단', '청운파출소', '종로소방서', '신교119안전센터', '청운효자동주민센터'];
    const rows = names.map((name, i) => [`n${i + 1}`, name, 12700000, 3700000, 'building', '공공시설', 1]);
    rows.push(['n6', '경찰서 앞 상가', 12700000, 3700000, 'building', '건물', 2]);
    expect(parseLandmarks({ v: 1, r: rows })!.map((p) => p.kind)).toEqual(['police', 'police', 'fire_station', 'fire_station', 'government', 'building']);
  });
});
