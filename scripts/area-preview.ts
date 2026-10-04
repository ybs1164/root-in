// Renders the area map for a few places to SVG (no browser map needed).
// npx vite-node scripts/area-preview.ts <outDir>
import { readFileSync, writeFileSync } from 'node:fs';
import { renderAreaMap, type AdminArea } from '../src/domain/adminAreas';
import { screenProjection } from '../src/domain/districtRendering';
import { parseAreas } from '../src/services/adminAreaService';
import type { MapViewport } from '../src/domain/districtMap';

const read = (p: string) => parseAreas(JSON.parse(readFileSync(`public/korea/admin/${p}`, 'utf8'))) as AdminArea[];
const out = process.argv[2] ?? '.';
const view = (lon: number, lat: number, spanLon: number, w = 375, h = 500): MapViewport => {
  const spanLat = (spanLon * h / w) * Math.cos(lat * Math.PI / 180);
  return { bounds: { west: lon - spanLon / 2, east: lon + spanLon / 2, south: lat - spanLat / 2, north: lat + spanLat / 2 }, widthPx: w };
};
const draw = (name: string, v: MapViewport, parts: AdminArea[], others: AdminArea[], h = 500) => {
  const shapes = renderAreaMap({ focus: { code: '', name }, parts, others }, v);
  const p = screenProjection(v);
  const top = p.project([v.bounds.west, v.bounds.north]).Y / 100;
  const d = (polys: typeof shapes.parts) => polys.map((rings) => rings.map((ring) =>
    'M' + ring.map((q) => { const s = p.project(q); return `${(s.X / 100).toFixed(1)},${(top - s.Y / 100).toFixed(1)}`; }).join('L') + 'Z').join('')).join('');
  writeFileSync(`${out}/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${v.widthPx}" height="${h}" viewBox="0 0 ${v.widthPx} ${h}">
<rect width="100%" height="100%" fill="#f4ede2"/><path d="${d(shapes.others)}" fill="#d6dfdc" fill-rule="evenodd"/><path d="${d(shapes.parts)}" fill="#a9c1c1" fill-rule="evenodd"/></svg>`);
};
// 강남구 역삼·대치 close up: 읍면동 sections.
const gangnamDong = read('dong/11680.json');
const sec = read('section/11680.json');
const yeoksam = gangnamDong.find((a) => a.name === '역삼1동')!;
draw('dong-yeoksam', view(127.036, 37.497, 0.035), sec.filter((a) => a.code.startsWith(yeoksam.code + '-')), gangnamDong.filter((a) => a !== yeoksam));
// 강남구 whole: 읍면동.
const sgg = read('sgg/11.json');
draw('sgg-gangnam', view(127.06, 37.5, 0.16), gangnamDong, sgg.filter((a) => a.code !== '11680'));
// 경기도 zoomed out: 시군구.


const sidoAll = parseAreas(JSON.parse(readFileSync('public/korea/admin/sido.json', 'utf8')).areas) as AdminArea[];
draw('sido-gyeonggi', view(127.2, 37.45, 2.2), read('sgg/41.json'), sidoAll.filter((a) => a.code !== '41'));
