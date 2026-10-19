// TODAY's 미니맵 on the example days without a browser (docs/plan-minimap-silhouette.md S7):
//   npx vite-node scripts/minimap-report.ts
// reads the map data straight from public/, draws each day as the day screen
// lays it out (map, line, pins, names; plain colours, not the theme) into
// ui-shots/minimap-days.html, and prints how much the pins cover one another.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { terrainService } from '../src/services/terrainService';
import { dayMap, type MapPart } from '../src/domain/miniMap';
import { fitPingLabels, infoRect, pingInfoSize } from '../src/domain/stopLabels';
import type { LonLat } from '../src/domain/districtMap';

globalThis.fetch = (async (url: string | URL) => {
  const path = decodeURIComponent(new URL(String(url), 'http://local/').pathname);
  try {
    return new Response(await readFile(`public${path}`), { status: 200 });
  } catch {
    return new Response('', { status: 404 });
  }
}) as typeof fetch;

const DAYS: Record<string, [string, number, number][]> = {
  street: [['어니언 성수', 127.0582, 37.5447], ['성수 갈비집', 127.0571, 37.544], ['소품샵', 127.059, 37.5436]],
  river: [['어니언 성수', 127.0582, 37.5447], ['성수 갈비집', 127.0557, 37.5431], ['대림창고', 127.0539, 37.5418], ['서울숲', 127.0374, 37.5444], ['압구정 로데오', 127.0396, 37.5272]],
  one: [['어니언 성수', 127.0582, 37.5447]],
  far: [['서울역', 126.9707, 37.5547], ['해운대', 129.1604, 35.1587]],
  row: [0, 1, 2, 3, 4, 5].map((k) => [['광화문', '종각', '종로3가', '종로5가', '동대문', '신설동'][k], 126.977 + k * 0.009, 37.5705 + k * 0.0004] as [string, number, number]),
  same: [['1층 카페', 127.0582, 37.5447], ['3층 서점', 127.05822, 37.54471]],
};

const PX = 330;
const COLOURS: Record<string, string> = { land: '#e8edf6', side: '#c6cede', water: '#cfd9ef', park: '#d5ecd9', road: '#ffffff', shadow: '#55607a', haze: '#fbf8f1' };
const path = (rings: { x: number; y: number }[][]) => rings.map((r) => `M${r.map((p) => `${(p.x * PX).toFixed(1)},${(p.y * PX).toFixed(1)}`).join('L')}Z`).join('');

function drawPart(day: string, part: MapPart, k: number): string {
  const colour = COLOURS[part.fill.role];
  const dy = (part.dy ?? 0) * PX;
  const clip = part.clip ? `clip-path="url(#c-${day}-${k})"` : '';
  const defs = part.clip ? `<clipPath id="c-${day}-${k}"><path clip-rule="evenodd" d="${path(part.clip)}"/></clipPath>` : '';
  const fill = part.polys.length
    ? `<path d="${path(part.polys)}" fill="${colour}" fill-rule="${part.evenodd ? 'evenodd' : 'nonzero'}" opacity="${part.fill.alpha ?? (part.haze ? 0.3 : 1)}" ${part.blur ? `filter="url(#blur)"` : ''} transform="translate(0 ${dy})"/>`
    : '';
  const ways = (part.ways ?? []).map((w) => `<polyline points="${w.path.map((p) => `${p.x * PX},${p.y * PX}`).join(' ')}" fill="none" stroke="${colour}" stroke-width="${w.w * PX}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `${defs}<g ${clip}>${fill}${ways}</g>`;
}

const pin = (x: number, y: number, k: number) =>
  `<path d="M${x},${y} C${x - 6 * k},${y - 14 * k} ${x - 17 * k},${y - 22 * k} ${x - 17 * k},${y - 30 * k} A${17 * k},${17 * k} 0 1 1 ${x + 17 * k},${y - 30 * k} C${x + 17 * k},${y - 22 * k} ${x + 6 * k},${y - 14 * k} ${x},${y}Z" fill="#6c90d8"/><circle cx="${x}" cy="${y - 30 * k}" r="${6 * k}" fill="#fff"/>`;

const cells: string[] = [];
for (const [name, spots] of Object.entries(DAYS)) {
  const centers = spots.map(([, lng, lat]) => [lng, lat] as LonLat);
  const latest = spots.length - 1;
  const shapes = await terrainService.fetch(centers);
  const { points, parts } = dayMap(shapes, centers, latest);
  const px = points.map((p) => ({ x: p.x * PX, y: p.y * PX }));
  const infos = spots.map(([n], i) => ({ name: n, time: `${String(9 + i * 2).padStart(2, '0')}:00`, latest: i === latest }));
  const labels = fitPingLabels(px, infos);
  // Pins covering pins (px²).
  const rect = (i: number) => {
    const k = i === latest ? 1.4 : 1;
    return { l: px[i].x - 17 * k, r: px[i].x + 17 * k, t: px[i].y - 44 * k, b: px[i].y };
  };
  let cover = 0;
  for (let i = 0; i < px.length; i++) {
    for (let j = i + 1; j < px.length; j++) {
      const [a, b] = [rect(i), rect(j)];
      cover += Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
    }
  }
  console.log(`${name}\tpins ${points.length}\tmap ${parts.length ? 'yes' : 'no'}\tpin-on-pin ${cover.toFixed(0)} px²\tnames ${labels.map((l) => l.name).join(', ')}`);
  const line = px.length > 1 ? `<polyline points="${px.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#fbf8f1" stroke-width="7" stroke-linejoin="round"/><polyline points="${px.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#2a3354" stroke-width="3" stroke-linejoin="round"/>` : '';
  const order = px.map((_, i) => i).sort((a, b) => px[a].y - px[b].y);
  const pins = order.map((i) => pin(px[i].x, px[i].y, i === latest ? 1.4 : 1)).join('');
  const names = labels
    .map((l, i) => {
      const box = infoRect(px[i], pingInfoSize(l.name, l.time, i === latest), l.side);
      const em = i === latest ? 15 : 13;
      const cx = (box.l + box.r) / 2;
      return `<text x="${cx}" y="${box.t + em}" font-size="${em}" text-anchor="middle" font-weight="700" fill="#2a3354" stroke="#fbf8f1" stroke-width="3" paint-order="stroke">${l.name}</text>${l.time ? `<text x="${cx}" y="${box.t + em + 17}" font-size="12" text-anchor="middle" fill="#8a91a8" stroke="#fbf8f1" stroke-width="3" paint-order="stroke">${l.time}</text>` : ''}`;
    })
    .join('');
  cells.push(`<div style="font:12px sans-serif"><b>${name}</b><br><svg width="${PX}" height="${PX}" viewBox="0 0 ${PX} ${PX}" style="background:#fbf8f1;overflow:visible"><defs><filter id="blur"><feGaussianBlur stdDeviation="8"/></filter></defs>${parts.map((part, k) => drawPart(name, part, k)).join('')}${line}${pins}${names}</svg></div>`);
}
await mkdir('ui-shots', { recursive: true });
await writeFile('ui-shots/minimap-days.html', `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fbf8f1"><div style="display:grid;grid-template-columns:repeat(3,${PX}px);gap:24px;padding:20px">${cells.join('')}</div></body>`);
