// Scratch: how broken is the road data? Counts loose ends (endpoints no other
// piece touches) at several snapping distances, per scale.
// npx vite-node scripts/_road-ends.ts
import { readFileSync, existsSync } from 'node:fs';
import type { BaseRoad } from '../src/domain/baseMap';
import { koreaMapLevelIndex, parseBaseTile, visibleKoreaTiles } from '../src/services/koreaMapService';

const W = 375, H = 700;
const manifest = JSON.parse(readFileSync('public/korea/base/manifest.json', 'utf8'));
for (const [name, mpp] of [['gu', 40], ['dong', 12], ['block', 1.5]] as const) {
  const [lon, lat] = [127.056, 37.544];
  const spanLon = (mpp * W) / (111320 * Math.cos((lat * Math.PI) / 180)), spanLat = (mpp * H) / 110540;
  const bounds = { west: lon - spanLon / 2, east: lon + spanLon / 2, south: lat - spanLat / 2, north: lat + spanLat / 2 };
  const level = manifest.levels[koreaMapLevelIndex({ bounds, widthPx: W })];
  const roads: BaseRoad[] = [];
  for (const key of visibleKoreaTiles(level, bounds)) {
    const f = `public/korea/base/${level.name}/${key}.json`;
    if (existsSync(f)) roads.push(...(parseBaseTile(JSON.parse(readFileSync(f, 'utf8')))?.roads ?? []));
  }
  const px = ([x, y]: [number, number]): [number, number] => [((x - bounds.west) / spanLon) * W, ((bounds.north - y) / spanLat) * H];
  const inside = ([x, y]: [number, number]) => x > 20 && x < W - 20 && y > 20 && y < H - 20;
  const tiers = new Map<number, number>();
  for (const r of roads) tiers.set(r.tier, (tiers.get(r.tier) ?? 0) + 1);
  const line = [`${name} (${level.name}): ${roads.length} pieces`, [...tiers].map(([t, n]) => `t${t}:${n}`).join(' ')];
  for (const snap of [0.05, 1, 3, 6]) {
    // All tiers together: a street ending on an avenue is joined, not loose.
    const ends = roads.flatMap((r) => [px(r.path[0]), px(r.path[r.path.length - 1])]);
    const verts = roads.flatMap((r) => r.path.map(px));
    const grid = new Map<string, number>();
    const key = (x: number, y: number) => `${Math.floor(x / snap)},${Math.floor(y / snap)}`;
    for (const [x, y] of verts) grid.set(key(x, y), (grid.get(key(x, y)) ?? 0) + 1);
    let loose = 0, shown = 0;
    for (const [x, y] of ends) {
      if (!inside([x, y])) continue;
      shown++;
      let n = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) n += grid.get(key(x + dx * snap, y + dy * snap)) ?? 0;
      if (n <= 1) loose++;
    }
    line.push(`snap ${snap}px: ${loose}/${shown} loose`);
  }
  console.log(line.join(' | '));
}
