import { describe, expect, it } from 'vitest';
import type { AdminArea, AreaMap } from '../domain/adminAreas';
import type { Bbox } from '../domain/districtMap';
import type { AdminAreaService } from './adminAreaService';
import { AdminTerrainService } from './terrainService';

const area = (code: string): AdminArea => ({ code, name: code, bbox: { west: 0, east: 1, south: 0, north: 1 }, polygons: [] });

describe('terrainService', () => {
  it('asks group by group when the stops are far apart, and merges what comes back', async () => {
    const asked: Bbox[] = [];
    // A fake area map: what it splits depends on where the middle of the asked range is.
    const fake: AdminAreaService = {
      async fetchAreaMap(_viewport, range) {
        asked.push(range!);
        const mid = (range!.west + range!.east) / 2;
        const map: AreaMap =
          mid < 127.0 ? { focus: { code: 'jung', name: 'jung' }, parts: [area('myeong'), area('shared')], others: [area('songpa')] }
          : mid > 127.08 ? { focus: { code: 'songpa', name: 'songpa' }, parts: [area('jamsil'), area('shared')], others: [area('jung')] }
          : { focus: { code: 'yongsan', name: 'yongsan' }, parts: [area('huam')], others: [area('jung'), area('songpa')] };
        return map;
      },
    };
    const shapes = await new AdminTerrainService(fake).fetch([[126.99, 37.566], [126.988, 37.563], [127.098, 37.511]]);
    expect(asked).toHaveLength(3);
    expect(shapes!.parts.map((a) => a.code).sort()).toEqual(['huam', 'jamsil', 'myeong', 'shared']);
    // What one ask split is not also a whole neighbour.
    expect(shapes!.others).toEqual([area('jung'), area('songpa')]);

    // Stops close together: one ask.
    asked.length = 0;
    await new AdminTerrainService(fake).fetch([[126.99, 37.566], [126.988, 37.563]]);
    expect(asked).toHaveLength(1);
  });

  it('gives null when nothing came back, and never rejects', async () => {
    const failing: AdminAreaService = { fetchAreaMap: () => Promise.reject(new Error('down')) };
    await expect(new AdminTerrainService(failing).fetch([[126.99, 37.566], [127.098, 37.511]])).resolves.toBeNull();
  });
});
