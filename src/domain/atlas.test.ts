import { describe, expect, it } from 'vitest';
import type { LonLat } from './districtMap';
import { atlasRegions, clampView, fitView, islandSize, MAX_ZOOM, minZoom, planAtlas, regionName, stopOnCanvas, zoomAbout, FIT_MIN_ZOOM } from './atlas';

// One day across Korea: nine regions, a few stops each (docs/plan-group-atlas.md GA0).
const NATION: Record<string, LonLat[]> = {
  seoul: [[127.0582, 37.5447], [127.0539, 37.5418], [127.0374, 37.5444]],
  busan: [[129.1604, 35.1587], [129.164, 35.162]],
  daejeon: [[127.4273, 36.3277], [127.4344, 36.3323], [127.3874, 36.3755]],
  jeonju: [[127.153, 35.815], [127.161, 35.8495]],
  gwangju: [[126.914, 35.1395], [126.9255, 35.1475]],
  daegu: [[128.596, 35.869], [128.606, 35.8605]],
  jeju: [[126.527, 33.512], [126.453, 33.498], [126.493, 33.507]],
  incheon: [[126.639, 37.3925], [126.6345, 37.3935]],
  gangneung: [[128.899, 37.7545], [128.908, 37.7955], [128.9475, 37.7725]],
};
const all = Object.values(NATION).flat();
const regionOf = (c: LonLat) => Object.keys(NATION).find((k) => NATION[k].includes(c))!;

describe('atlasRegions', () => {
  it('makes one region per city, each stop in exactly one', () => {
    const groups = atlasRegions(all);
    expect(groups).toHaveLength(9);
    expect(groups.flat().sort((a, b) => a - b)).toEqual(all.map((_, i) => i));
    for (const g of groups) expect(new Set(g.map((i) => regionOf(all[i]))).size).toBe(1);
  });

  it('keeps a city whole: stops a few km apart are one island', () => {
    // 성수 and 서울숲 are ~2km apart; 대전역 and 엑스포 다리 ~6km.
    expect(atlasRegions([...NATION.seoul, ...NATION.daejeon])).toHaveLength(2);
  });

  it('merges the nearest past the limit', () => {
    // A row of 14 spots 20km apart: 14 regions, merged down to 12.
    const row = Array.from({ length: 14 }, (_, i) => [126.5 + i * 0.22, 36] as LonLat);
    expect(atlasRegions(row)).toHaveLength(14 > 12 ? 12 : 14);
    expect(atlasRegions(row, undefined, 14)).toHaveLength(14);
  });

  it('is empty without stops', () => {
    expect(atlasRegions([])).toEqual([]);
  });
});

describe('planAtlas', () => {
  const plan = planAtlas(all);
  const named = new Map(plan.islands.map((island) => [regionOf(all[island.stops[0]]), island]));

  it('lets no two islands overlap', () => {
    for (const [i, a] of plan.islands.entries()) {
      for (const b of plan.islands.slice(i + 1)) {
        const room = (a.size + b.size) * 0.38 + 20;
        expect(Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y)).toBeGreaterThanOrEqual(room - 0.5);
      }
    }
  });

  it('keeps which way each region lies', () => {
    const at = (k: string) => named.get(k)!.at;
    // North over south, west left of east.
    expect(at('seoul').y).toBeLessThan(at('daejeon').y);
    expect(at('daejeon').y).toBeLessThan(at('busan').y);
    expect(at('busan').y).toBeLessThan(at('jeju').y);
    expect(at('incheon').x).toBeLessThan(at('gangneung').x);
    expect(at('gwangju').x).toBeLessThan(at('daegu').x);
    expect(at('jeonju').x).toBeLessThan(at('daegu').x);
  });

  it('fits every island on the canvas, about a phone and a half wide', () => {
    for (const island of plan.islands) {
      expect(island.at.x - island.size * 0.42).toBeGreaterThanOrEqual(0);
      expect(island.at.x + island.size * 0.42).toBeLessThanOrEqual(plan.width);
      expect(island.at.y - island.size * 0.3).toBeGreaterThanOrEqual(0);
      expect(island.at.y + island.size * 0.3).toBeLessThanOrEqual(plan.height);
    }
    expect(plan.width).toBeLessThan(375 * 1.8);
  });

  it('bends Korea with the islands: a region\'s own spot lands on its island', () => {
    for (const [k, island] of named) {
      const p = plan.toCanvas(island.center);
      expect(Math.hypot(p.x - island.at.x, p.y - island.at.y), k).toBeLessThan(1);
    }
  });

  it('sizes an island by its stops', () => {
    expect(islandSize(1)).toBe(150);
    expect(islandSize(3)).toBe(182);
    expect(islandSize(50)).toBe(230);
    expect(named.get('seoul')!.size).toBe(182);
  });

  it('puts a stop over its island square', () => {
    const island = named.get('seoul')!;
    expect(stopOnCanvas(island, { x: 0.5, y: 0.5 })).toEqual(island.at);
    expect(stopOnCanvas(island, { x: 0, y: 0 })).toEqual({ x: island.at.x - island.size / 2, y: island.at.y - island.size / 2 });
  });

  it('is the same every time (no randomness)', () => {
    expect(planAtlas(all).islands).toEqual(plan.islands);
  });

  it('draws all of Korea when there are no pings', () => {
    const empty = planAtlas([]);
    expect(empty.islands).toEqual([]);
    expect(empty.width).toBeGreaterThan(300);
    expect(empty.height).toBeGreaterThan(empty.width);
  });

  it('spreads a 수도권 day as wide, never one region as a wall of Korea', () => {
    const metro = planAtlas([[127.0582, 37.5447], [126.9237, 37.5572], [127.1112, 37.3925], [126.77, 37.658], [127.013, 37.282]]);
    expect(metro.islands).toHaveLength(5);
    expect(metro.width).toBeLessThan(375 * 1.8);
    const one = planAtlas([[127.0582, 37.5447]]);
    expect(one.islands).toHaveLength(1);
    // 1200 px a degree at most: the island is 150px, Korea about 6000px tall.
    const north = one.toCanvas([127, 38.6]);
    const south = one.toCanvas([127, 33.2]);
    expect(south.y - north.y).toBeLessThanOrEqual(5.4 * 1200 + 1);
  });
});

describe('regionName', () => {
  it('names a big city\'s 구 with the city', () => {
    expect(regionName('서울특별시', '성동구')).toBe('서울 성동구');
    expect(regionName('부산광역시', '해운대구')).toBe('부산 해운대구');
    expect(regionName('전남광주통합특별시', '동구')).toBe('광주 동구');
  });

  it('names a 시\'s 구 with the 시, shortened', () => {
    expect(regionName('경기도', '수원시팔달구')).toBe('수원 팔달구');
    expect(regionName('전북특별자치도', '전주시덕진구')).toBe('전주 덕진구');
  });

  it('leaves a 시 or 군 alone', () => {
    expect(regionName('강원특별자치도', '강릉시')).toBe('강릉시');
    expect(regionName('전남광주통합특별시', '담양군')).toBe('담양군');
    expect(regionName('제주특별자치도', '제주시')).toBe('제주시');
  });
});

describe('the view', () => {
  const room = { left: 0, top: 100, right: 375, bottom: 692 };

  it('zooms out no further than the whole canvas, in no further than MAX_ZOOM', () => {
    expect(clampView({ zoom: 0.01, x: 0, y: 0 }, 600, 1000, room).zoom).toBeCloseTo(minZoom(600, 1000, room));
    expect(clampView({ zoom: 99, x: 0, y: 0 }, 600, 1000, room).zoom).toBe(MAX_ZOOM);
  });

  it('centres a canvas smaller than the room', () => {
    const v = clampView({ zoom: 0.9, x: -999, y: 999 }, 400, 400, room);
    expect(v.zoom).toBe(0.9);
    expect(v.x).toBeCloseTo((375 - 360) / 2);
    expect(v.y).toBeCloseTo(100 + (592 - 360) / 2);
  });

  it('lets a big canvas be dragged only so far past the room', () => {
    const v = clampView({ zoom: 2, x: 5000, y: -99999 }, 600, 1000, room);
    expect(v.x).toBeCloseTo(375 * 0.4);
    expect(v.y).toBeCloseTo(692 - 592 * 0.4 - 2000);
  });

  it('keeps the point under the fingers when zooming', () => {
    const v = zoomAbout({ zoom: 1, x: 10, y: 20 }, 2, { x: 110, y: 220 });
    // Canvas (100, 200) was under (110, 220); it still is.
    expect(100 * v.zoom + v.x).toBeCloseTo(110);
    expect(200 * v.zoom + v.y).toBeCloseTo(220);
  });

  it('fits points readable, and one point close', () => {
    const screen = { width: 375, height: 812 };
    const pad = { top: 150, right: 76, bottom: 197, left: 76 };
    const wide = fitView([{ x: 0, y: 0 }, { x: 600, y: 1000 }], screen, pad, { zoom: 1, x: 0, y: 0 })!;
    expect(wide.zoom).toBe(FIT_MIN_ZOOM);
    const near = fitView([{ x: 0, y: 0 }, { x: 60, y: 40 }], screen, pad, { zoom: 1, x: 0, y: 0 })!;
    expect(near.zoom).toBeGreaterThan(1.5);
    const one = fitView([{ x: 300, y: 300 }], screen, pad, { zoom: 0.8, x: 0, y: 0 })!;
    expect(one.zoom).toBe(1.6);
    expect(fitView([], screen, pad, { zoom: 1, x: 0, y: 0 })).toBeNull();
  });
});
