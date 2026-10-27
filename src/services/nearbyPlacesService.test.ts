import { describe, expect, it, vi } from 'vitest';
import type { AdminArea } from '../domain/adminAreas';
import type { KindShop } from '../domain/placeMatch';
import { NearbyPlacesService } from './nearbyPlacesService';

const viewport = { bounds: { west: 127, south: 37, east: 127.01, north: 37.01 }, widthPx: 400 };
const rows: Record<string, KindShop[]> = {
  '11110': [{ name: '카페', x: 12700400, y: 3700500, kind: 'cafe' }],
  '41110': [{ name: '식당', x: 12700800, y: 3700700, kind: 'restaurant' }],
};
const admin = () => ({ sggAreasInBounds: vi.fn(async () => Object.keys(rows).map((code) => ({ code } as AdminArea))) });

describe('nearby places service', () => {
  it('reads every visible district, including a neighboring province', async () => {
    const shops = { loadShops: vi.fn(async (code: string) => rows[code]) };
    const places = await new NearbyPlacesService(admin(), shops).fetch(viewport);
    expect(shops.loadShops.mock.calls.map(([code]) => code)).toEqual(['11110', '41110']);
    expect(places.map((p) => p.kind)).toEqual(['cafe', 'restaurant']);
  });
  it('does not download place files when zoomed out or given an invalid viewport', async () => {
    const areas = admin();
    const service = new NearbyPlacesService(areas);
    expect(await service.fetch({ ...viewport, widthPx: 20 })).toEqual([]);
    expect(await service.fetch({ ...viewport, widthPx: NaN })).toEqual([]);
    expect(areas.sggAreasInBounds).not.toHaveBeenCalled();
  });
  it('keeps data from other districts if one place file is missing', async () => {
    const shops = { loadShops: async (code: string) => code === '11110' ? null : rows[code] };
    expect((await new NearbyPlacesService(admin(), shops).fetch(viewport)).map((p) => p.name)).toEqual(['식당']);
  });
  it('returns an empty result on a network failure', async () => {
    const areas = { sggAreasInBounds: async () => { throw new Error('offline'); } };
    expect(await new NearbyPlacesService(areas).fetch(viewport)).toEqual([]);
  });
});
