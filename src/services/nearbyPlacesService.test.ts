import { describe, expect, it, vi } from 'vitest';
import type { AdminArea } from '../domain/adminAreas';
import type { Bbox } from '../domain/districtMap';
import type { KindShop } from '../domain/placeMatch';
import { NearbyPlacesService } from './nearbyPlacesService';

const viewport = { bounds: { west: 127, south: 37, east: 127.01, north: 37.01 }, widthPx: 400 };
const rows: Record<string, KindShop[]> = {
  '11110': [{ name: '카페', x: 12700400, y: 3700500, kind: 'cafe' }],
  '41110': [{ name: '식당', x: 12700800, y: 3700700, kind: 'restaurant' }],
};
const admin = () => ({ sggAreasInBounds: vi.fn(async (_bounds: Bbox) => Object.keys(rows).map((code) => ({ code } as AdminArea))) });
vi.mock('./landmarkService', () => ({ LandmarkService: class { async fetch() { return []; } } }));

describe('nearby places service', () => {
  it('reads every visible district, including a neighboring province', async () => {
    const shops = { loadShops: vi.fn(async (code: string) => rows[code]) };
    const places = await new NearbyPlacesService(admin(), shops).fetch(viewport);
    expect(shops.loadShops.mock.calls.map(([code]) => code)).toEqual(['11110', '41110']);
    expect(places.map((p) => p.kind).sort()).toEqual(['cafe', 'restaurant']);
  });
  it('loads neighboring districts covering whole selection cells, even beyond the screen', async () => {
    const areas = admin();
    await new NearbyPlacesService(areas, { loadShops: async (code) => rows[code] }).fetch(viewport);
    const [bounds] = areas.sggAreasInBounds.mock.calls[0];
    expect(bounds.west).toBeLessThan(viewport.bounds.west);
    expect(bounds.east).toBeGreaterThan(viewport.bounds.east);
    expect(bounds.south).toBeLessThan(viewport.bounds.south);
    expect(bounds.north).toBeGreaterThan(viewport.bounds.north);
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

  it('shows landmarks before slow shops, and still shows them if shop loading fails', async () => {
    const school = { id: 'landmark:r1', name: '숭실대학교', center: [127.004, 37.005] as [number, number], kind: 'school' as const, importance: 0 as const };
    let fail!: () => void;
    const shops = { loadShops: () => new Promise<KindShop[]>((_, reject) => { fail = () => reject(new Error('offline')); }) };
    const areas = { sggAreasInBounds: async () => [{ code: '11110' } as AdminArea] };
    const progress = vi.fn();
    const pending = new NearbyPlacesService(areas, shops, { fetch: async () => [school] }).fetch(viewport, {}, progress);
    await vi.waitFor(() => expect(progress).toHaveBeenCalledWith([school]));
    fail();
    expect(await pending).toEqual([school]);
  });

  it('keeps one place per kind on the screen, preferring a familiar one', async () => {
    const twins: Record<string, KindShop[]> = { '11110': [
      { name: '체인카페', x: 12700200, y: 3700200, kind: 'cafe' }, { name: '체인카페', x: 12700900, y: 3700900, kind: 'cafe' },
      { name: '골목카페', x: 12700500, y: 3700500, kind: 'cafe' },
    ] };
    const service = new NearbyPlacesService({ sggAreasInBounds: async () => [{ code: '11110' } as AdminArea] }, { loadShops: async (code) => twins[code] });
    const plain = await service.fetch(viewport);
    expect(plain.map((p) => p.name)).toEqual(['체인카페']);
    const visited = await service.fetch(viewport, { profile: { kinds: {}, spots: [{ x: 12700500, y: 3700500, name: '골목카페' }] } });
    expect(visited.map((p) => p.name)).toEqual(['골목카페']);
  });

  it('shows campuses at district scale without downloading shop files', async () => {
    const areas = admin();
    const school = { id: 'landmark:r1', name: '숭실대학교', center: [127.004, 37.005] as [number, number], kind: 'school' as const, importance: 0 as const };
    const service = new NearbyPlacesService(areas, { loadShops: async () => [] }, { fetch: async () => [school] });
    expect(await service.fetch({ ...viewport, widthPx: 40 })).toEqual([school]);
    expect(areas.sggAreasInBounds).not.toHaveBeenCalled();
  });
});
