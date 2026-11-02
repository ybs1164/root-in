// GA0 of docs/plan-group-atlas.md: the group map as islands of TODAY-style
// pictures, drawn without a browser:
//   npx vite-node scripts/atlas-report.ts
// reads the map data straight from public/ (like minimap-report.ts), makes one
// island per region of an example group's day and writes the mockups side by
// side into ui-shots/atlas.html and output/group-drafts-2026-11-02/atlas.html:
// A a day across Korea over a faint Korea, B the same day with no Korea but
// straight-line distances between neighbouring islands, D a 수도권 day (eight
// regions close together) where Korea would only be empty land, with the same
// distances. Prints how much islands cover one another (the layout's hard rule).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { terrainService } from '../src/services/terrainService';
import { bendField, dayMap, type MapPart, type MapPoint } from '../src/domain/miniMap';
import type { LonLat } from '../src/domain/districtMap';

globalThis.fetch = (async (url: string | URL) => {
  const path = decodeURIComponent(new URL(String(url), 'http://local/').pathname);
  try {
    return new Response(await readFile(`public${path}`), { status: 200 });
  } catch {
    return new Response('', { status: 404 });
  }
}) as typeof fetch;

// --- The example group: six members, two days --------------------------------
const MEMBERS = [
  { name: '민수', colour: '#8ccbe8' },
  { name: '지은', colour: '#ee89b6' },
  { name: '하준', colour: '#efb94f' },
  { name: '서연', colour: '#c49be0' },
  { name: '도윤', colour: '#a4c75a' },
  { name: '유나', colour: '#ec8177' },
];
type Ping = { m: number; name: string; lng: number; lat: number; at: string };
interface Day {
  title: string;
  pings: Ping[];
  /** Region names would come from the 시군구 data (GA1); here the nearest of these. */
  names: [string, number, number][];
}

const NATION: Day = {
  title: '주말 전국팟',
  pings: [
    { m: 0, name: '어니언 성수', lng: 127.0582, lat: 37.5447, at: '09:10' },
    { m: 0, name: '대림창고', lng: 127.0539, lat: 37.5418, at: '10:30' },
    { m: 0, name: '서울숲', lng: 127.0374, lat: 37.5444, at: '11:40' },
    { m: 0, name: '해운대 해수욕장', lng: 129.1604, lat: 35.1587, at: '16:20' },
    { m: 0, name: '해리단길', lng: 129.164, lat: 35.162, at: '18:00' },
    { m: 1, name: '성심당', lng: 127.4273, lat: 36.3277, at: '08:40' },
    { m: 1, name: '대전역', lng: 127.4344, lat: 36.3323, at: '09:30' },
    { m: 1, name: '엑스포 다리', lng: 127.3874, lat: 36.3755, at: '11:00' },
    { m: 1, name: '전주 한옥마을', lng: 127.153, lat: 35.815, at: '14:30' },
    { m: 1, name: '전주역', lng: 127.161, lat: 35.8495, at: '17:10' },
    { m: 2, name: '양림동', lng: 126.914, lat: 35.1395, at: '10:00' },
    { m: 2, name: '동명동 카페', lng: 126.9255, lat: 35.1475, at: '11:20' },
    { m: 2, name: '동성로', lng: 128.596, lat: 35.869, at: '15:40' },
    { m: 2, name: '김광석길', lng: 128.606, lat: 35.8605, at: '17:30' },
    { m: 3, name: '동문시장', lng: 126.527, lat: 33.512, at: '09:00' },
    { m: 3, name: '이호테우 해변', lng: 126.453, lat: 33.498, at: '12:10' },
    { m: 3, name: '제주공항', lng: 126.493, lat: 33.507, at: '15:00' },
    { m: 4, name: '센트럴파크', lng: 126.639, lat: 37.3925, at: '13:00' },
    { m: 4, name: '트라이볼', lng: 126.6345, lat: 37.3935, at: '14:10' },
    { m: 5, name: '중앙시장', lng: 128.899, lat: 37.7545, at: '10:40' },
    { m: 5, name: '경포대', lng: 128.908, lat: 37.7955, at: '13:20' },
    { m: 5, name: '안목해변', lng: 128.9475, lat: 37.7725, at: '15:50' },
  ],
  names: [
    ['서울 성동', 127.05, 37.54], ['부산 해운대', 129.16, 35.16], ['대전 중구', 127.42, 36.34], ['전주 완산', 127.15, 35.83],
    ['광주 동구', 126.92, 35.14], ['대구 중구', 128.6, 35.86], ['제주시', 126.49, 33.5], ['인천 연수', 126.64, 37.39], ['강릉', 128.91, 37.77],
  ],
};

const METRO: Day = {
  title: '서울 근교팟',
  pings: [
    { m: 0, name: '어니언 성수', lng: 127.0582, lat: 37.5447, at: '09:10' },
    { m: 0, name: '서울숲', lng: 127.0374, lat: 37.5444, at: '10:30' },
    { m: 0, name: '판교역', lng: 127.1112, lat: 37.3925, at: '14:00' },
    { m: 0, name: '판교 카페거리', lng: 127.103, lat: 37.396, at: '15:30' },
    { m: 1, name: '홍대입구', lng: 126.9237, lat: 37.5572, at: '11:00' },
    { m: 1, name: '연남동', lng: 126.9245, lat: 37.562, at: '12:20' },
    { m: 1, name: '일산 호수공원', lng: 126.77, lat: 37.658, at: '17:00' },
    { m: 2, name: '행궁동', lng: 127.013, lat: 37.282, at: '10:00' },
    { m: 2, name: '수원 화성', lng: 127.018, lat: 37.287, at: '11:30' },
    { m: 3, name: '송도 센트럴파크', lng: 126.639, lat: 37.3925, at: '13:00' },
    { m: 3, name: '부천역', lng: 126.783, lat: 37.484, at: '16:30' },
    { m: 4, name: '부대찌개 거리', lng: 127.047, lat: 37.738, at: '12:00' },
    { m: 4, name: '대림창고', lng: 127.0539, lat: 37.5418, at: '18:00' },
    { m: 5, name: '연남 철길', lng: 126.922, lat: 37.56, at: '13:40' },
    { m: 5, name: '상동 호수공원', lng: 126.753, lat: 37.505, at: '18:30' },
  ],
  names: [
    ['서울 성동', 127.05, 37.54], ['서울 마포', 126.92, 37.56], ['성남 분당', 127.11, 37.39], ['고양 일산', 126.77, 37.66],
    ['수원 팔달', 127.015, 37.285], ['인천 연수', 126.64, 37.39], ['부천', 126.77, 37.5], ['의정부', 127.05, 37.74],
  ],
};

const REGION_GAP_M = 8000;
const KX = Math.cos((36 * Math.PI) / 180);
const metresApart = (a: { lng: number; lat: number }, b: { lng: number; lat: number }) => Math.hypot((a.lng - b.lng) * KX, a.lat - b.lat) * 111320;

interface Island {
  name: string;
  pings: number[]; // indices into the day's pings, in time order
  lng: number;
  lat: number;
  size: number;
  points: MapPoint[]; // unit square
  parts: MapPart[];
  at: MapPoint; // placed centre, px
  anchor: MapPoint; // real centre, px
}
interface Link {
  a: number;
  b: number;
  metres: number;
}
interface Atlas {
  day: Day;
  islands: Island[];
  regionOf: Map<number, number>;
  latestOf: number[];
  links: Link[];
  korea: MapPoint[][];
  W: number;
  H: number;
  place(p: MapPoint): MapPoint;
}

// --- Korea's outline, once ---------------------------------------------------
type Ring = [number, number][];
const sido = JSON.parse(await readFile('public/korea/admin/sido.json', 'utf8')) as { areas: { rings: Ring[][] }[] };
const dp = (ring: MapPoint[], tol: number): MapPoint[] => {
  if (ring.length < 4) return ring;
  const keep = new Array(ring.length).fill(false);
  keep[0] = keep[ring.length - 1] = true;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let [far, at] = [0, -1];
    for (let i = a + 1; i < b; i++) {
      const [p, q, r] = [ring[a], ring[b], ring[i]];
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      // A closed ring starts and ends on one point: there, distance to that point.
      const d = len ? Math.abs((q.x - p.x) * (p.y - r.y) - (p.x - r.x) * (q.y - p.y)) / len : Math.hypot(r.x - p.x, r.y - p.y);
      if (d > far) [far, at] = [d, i];
    }
    if (far > tol) {
      keep[at] = true;
      stack.push([a, at], [at, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
};
const areaOf = (r: MapPoint[]) => Math.abs(r.reduce((s, p, i) => s + (r[(i + 1) % r.length].x - p.x) * (r[(i + 1) % r.length].y + p.y), 0) / 2);
const outlines = sido.areas
  .flatMap((a) => a.rings.map((poly) => poly[0]))
  // 울릉·독도 would only widen the canvas (no group goes there in the example; GA4 decides insets).
  .filter((ring) => ring.every(([lng]) => lng < 130));

/** Neighbouring islands to label with their distance: the shortest tree joining them all (Prim, on the ground). */
function nearestTree(islands: Island[]): Link[] {
  if (islands.length < 2) return [];
  const inTree = new Set([0]);
  const links: Link[] = [];
  while (inTree.size < islands.length) {
    let best: Link | null = null;
    for (const a of inTree) {
      islands.forEach((s, b) => {
        if (inTree.has(b)) return;
        const metres = metresApart(islands[a], s);
        if (!best || metres < best.metres) best = { a, b, metres };
      });
    }
    links.push(best!);
    inTree.add(best!.b);
  }
  return links;
}

async function build(day: Day): Promise<Atlas> {
  const { pings: PINGS } = day;
  // Regions: single linkage within REGION_GAP_M.
  const parent = PINGS.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  PINGS.forEach((a, i) => PINGS.forEach((b, j) => j > i && metresApart(a, b) <= REGION_GAP_M && (parent[find(i)] = find(j))));
  const groups = new Map<number, number[]>();
  PINGS.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));

  const regionOf = new Map<number, number>();
  const islands: Island[] = [];
  for (const members of groups.values()) {
    const pings = [...members].sort((a, b) => PINGS[a].at.localeCompare(PINGS[b].at));
    const lng = pings.reduce((s, i) => s + PINGS[i].lng, 0) / pings.length;
    const lat = pings.reduce((s, i) => s + PINGS[i].lat, 0) / pings.length;
    const name = day.names.reduce((best, n) => (Math.hypot(n[1] - lng, n[2] - lat) < Math.hypot(best[1] - lng, best[2] - lat) ? n : best))[0];
    const centers = pings.map((i) => [PINGS[i].lng, PINGS[i].lat] as LonLat);
    const t0 = Date.now();
    const shapes = await terrainService.fetch(centers);
    const { points, parts } = dayMap(shapes, centers, -1);
    const size = Math.min(230, 150 + 16 * (pings.length - 1));
    pings.forEach((i) => regionOf.set(i, islands.length));
    islands.push({ name, pings, lng, lat, size, points, parts, at: { x: 0, y: 0 }, anchor: { x: 0, y: 0 } });
    console.log(`  ${name}\tpings ${pings.length}\tmap ${parts.length ? 'yes' : 'no'}\t${Date.now() - t0}ms`);
  }

  // Placing: real spot (scaled so the regions spread over about a phone and a half), then pushed apart (Dorling).
  const lngs = islands.map((s) => s.lng);
  const lats = islands.map((s) => s.lat);
  const spanX = Math.max(0.05, (Math.max(...lngs) - Math.min(...lngs)) * KX);
  const spanY = Math.max(0.05, Math.max(...lats) - Math.min(...lats));
  const K = Math.min(420 / spanX, 650 / spanY); // px per degree of latitude
  const project = (lng: number, lat: number): MapPoint => ({ x: (lng - 126) * KX * K, y: (38.7 - lat) * K });
  const radius = (s: Island) => s.size * 0.38 + 10;
  for (const s of islands) s.anchor = s.at = project(s.lng, s.lat);
  for (let round = 0; round < 600; round++) {
    const pull = round < 450 ? 0.03 : 0;
    for (const s of islands) s.at = { x: s.at.x + (s.anchor.x - s.at.x) * pull, y: s.at.y + (s.anchor.y - s.at.y) * pull };
    for (let i = 0; i < islands.length; i++) {
      for (let j = i + 1; j < islands.length; j++) {
        const [a, b] = [islands[i], islands[j]];
        let [dx, dy] = [b.at.x - a.at.x, b.at.y - a.at.y];
        const d = Math.hypot(dx, dy) || 1;
        const need = radius(a) + radius(b);
        if (d >= need) continue;
        if (d === 1 && dx === 0 && dy === 0) [dx, dy] = [1, 0];
        const push = (need - d) / 2;
        a.at = { x: a.at.x - (dx / d) * push, y: a.at.y - (dy / d) * push };
        b.at = { x: b.at.x + (dx / d) * push, y: b.at.y + (dy / d) * push };
      }
    }
  }

  // Korea behind, bent with the islands.
  const bend = bendField(islands.map((s) => s.anchor), islands.map((s) => s.at));
  const korea = outlines
    .map((ring) => dp(ring.map(([lng, lat]) => project(lng, lat)), 1.2))
    .filter((r) => r.length > 3 && areaOf(r) > 40)
    .map((r) => r.map(bend));

  // Canvas: the islands' land plus a margin (Korea behind is only context, cut at the edges).
  const MARGIN = 28;
  const boxes = islands.map((s) => ({ l: s.at.x - s.size * 0.42, r: s.at.x + s.size * 0.42, t: s.at.y - s.size * 0.3 - 18, b: s.at.y + s.size * 0.3 }));
  const allX = boxes.flatMap((b) => [b.l, b.r]);
  const allY = boxes.flatMap((b) => [b.t, b.b]);
  const oy = Math.min(...allY) - MARGIN - 70;
  const W = Math.max(375, Math.max(...allX) - Math.min(...allX) + 2 * MARGIN);
  const H = Math.max(...allY) - oy + MARGIN + 120;
  const shiftX = (W - (Math.max(...allX) - Math.min(...allX))) / 2 - Math.min(...allX);

  let cover = 0;
  islands.forEach((a, i) => islands.forEach((b, j) => j > i && (cover += Math.max(0, radius(a) + radius(b) - Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y)))));
  console.log(`${day.title}: islands ${islands.length}\tcanvas ${W.toFixed(0)}×${H.toFixed(0)}px (${(W / 375).toFixed(2)}× · ${(H / 812).toFixed(2)}× a phone)\tisland overlap ${cover.toFixed(1)}px`);

  const latestOf = MEMBERS.map((_, m) => PINGS.reduce((best, p, i) => (p.m === m && (best < 0 || p.at > PINGS[best].at) ? i : best), -1));
  return { day, islands, regionOf, latestOf, links: nearestTree(islands), korea, W, H, place: (p) => ({ x: p.x + shiftX, y: p.y - oy }) };
}

// --- Drawing ---------------------------------------------------------------
const COLOURS: Record<string, string> = { land: '#e3e9f5', side: '#c3cce0', water: '#cbd7ef', park: '#d3eadb', road: '#ffffff', shadow: '#55607a', haze: '#fbf8f1' };
const f = (n: number) => n.toFixed(1);
let uid = 0;

function islandSvg(s: Island, px: number): string {
  const id = `i${uid++}`;
  const path = (rings: MapPoint[][]) => rings.map((r) => `M${r.map((p) => `${f(p.x * px)},${f(p.y * px)}`).join('L')}Z`).join('');
  return s.parts
    .map((part, k) => {
      const colour = COLOURS[part.fill.role];
      const clip = part.clip ? `<clipPath id="${id}c${k}"><path clip-rule="evenodd" d="${path(part.clip)}"/></clipPath>` : '';
      const fill = part.polys.length
        ? `<path d="${path(part.polys)}" fill="${colour}" fill-rule="${part.evenodd ? 'evenodd' : 'nonzero'}" opacity="${part.fill.alpha ?? (part.haze ? 0.3 : 1)}" ${part.blur ? `filter="url(#soft)"` : ''} ${part.seal ? `stroke="${colour}" stroke-width="${part.seal * px}"` : ''} transform="translate(0 ${f((part.dy ?? 0) * px)})"/>`
        : '';
      const ways = (part.ways ?? []).map((w) => `<polyline points="${w.path.map((p) => `${f(p.x * px)},${f(p.y * px)}`).join(' ')}" fill="none" stroke="${colour}" stroke-width="${f(w.w * px)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
      return `${clip}<g ${part.clip ? `clip-path="url(#${id}c${k})"` : ''}>${fill}${ways}</g>`;
    })
    .join('');
}

const PIN_K = 0.72;
const pin = (x: number, y: number, colour: string, k = PIN_K) =>
  `<path d="M${f(x)},${f(y)} C${f(x - 6 * k)},${f(y - 14 * k)} ${f(x - 17 * k)},${f(y - 22 * k)} ${f(x - 17 * k)},${f(y - 30 * k)} A${f(17 * k)},${f(17 * k)} 0 1 1 ${f(x + 17 * k)},${f(y - 30 * k)} C${f(x + 17 * k)},${f(y - 22 * k)} ${f(x + 6 * k)},${f(y - 14 * k)} ${f(x)},${f(y)}Z" fill="${colour}"/><circle cx="${f(x)}" cy="${f(y - 30 * k)}" r="${f(6 * k)}" fill="#fff"/>`;
/** A member's face (their latest ping): no photos in a mockup, so a person glyph in their colour. */
const face = (x: number, y: number, colour: string, r = 15) =>
  `<g><circle cx="${f(x)}" cy="${f(y - r - 4)}" r="${r}" fill="#fff" stroke="${colour}" stroke-width="3"/><circle cx="${f(x)}" cy="${f(y - r - 8)}" r="${f(r * 0.32)}" fill="${colour}"/><path d="M${f(x - r * 0.55)},${f(y - r + 5)} a${f(r * 0.55)},${f(r * 0.5)} 0 0 1 ${f(r * 1.1)},0Z" fill="${colour}"/><path d="M${f(x - 4)},${f(y - 4.5)} L${f(x)},${f(y)} L${f(x + 4)},${f(y - 4.5)}Z" fill="${colour}"/></g>`;

/** Where a ping stands inside its island, in that island's own px (0..size). */
const local = (atlas: Atlas, i: number): MapPoint => {
  const s = atlas.islands[atlas.regionOf.get(i)!];
  const p = s.points[s.pings.indexOf(i)];
  return { x: p.x * s.size, y: p.y * s.size };
};

/** Lines (each member's legs inside the island), pins and faces, in the island's own px. */
function islandMarks(atlas: Atlas, s: Island): string {
  const { pings: PINGS } = atlas.day;
  const legs: string[] = [];
  MEMBERS.forEach((m, k) => {
    const mine = s.pings.filter((i) => PINGS[i].m === k);
    for (let n = 1; n < mine.length; n++) {
      const [a, b] = [local(atlas, mine[n - 1]), local(atlas, mine[n])];
      legs.push(`<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="#fffdf8" stroke-width="6" stroke-linecap="round"/><line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="${m.colour}" stroke-width="3" stroke-linecap="round"/>`);
    }
  });
  const order = [...s.pings].sort((a, b) => local(atlas, a).y - local(atlas, b).y);
  const marks = order.map((i) => {
    const p = local(atlas, i);
    const colour = MEMBERS[PINGS[i].m].colour;
    return atlas.latestOf[PINGS[i].m] === i ? face(p.x, p.y, colour) : pin(p.x, p.y, colour);
  });
  return legs.join('') + marks.join('');
}

const label = (x: number, y: number, text: string) =>
  `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" class="atlas-name" stroke="#fbf8f1" stroke-width="4" paint-order="stroke">${text}</text>`;

/** Straight-line distance as read at a glance: one decimal under 10km, whole km under 100, tens of km beyond. */
const km = (metres: number) => {
  const k = metres / 1000;
  return k < 10 ? `${k.toFixed(1)}km` : k < 100 ? `${Math.round(k)}km` : `${Math.round(k / 10) * 10}km`;
};

/** Where the line from an island's middle toward `toward` leaves its land (an ellipse: the land is tilted flat). */
const rim = (s: Island, from: MapPoint, toward: MapPoint): MapPoint => {
  const [dx, dy] = [toward.x - from.x, toward.y - from.y];
  const len = Math.hypot(dx, dy) || 1;
  const [c, sn] = [dx / len, dy / len];
  const r = 1 / Math.hypot(c / (s.size * 0.36), sn / (s.size * 0.2));
  return { x: from.x + c * r, y: from.y + sn * r };
};

/** One whole canvas: `korea` draws the land behind, `links` the distances between neighbouring islands. */
function canvas(atlas: Atlas, { korea, links }: { korea: boolean; links: boolean }): string {
  const { islands, place } = atlas;
  const { pings: PINGS } = atlas.day;
  const land = korea
    ? `<path d="${atlas.korea.map((r) => `M${r.map((p) => { const q = place(p); return `${f(q.x)},${f(q.y)}`; }).join('L')}Z`).join('')}" fill="#f0ece2" stroke="#f0ece2" stroke-width="1.5" stroke-linejoin="round"/>`
    : '';
  // Distances: a thin grey line from rim to rim under the islands, its length in a pill over everything.
  const lines: string[] = [];
  const pills: string[] = [];
  if (links) {
    for (const { a, b, metres } of atlas.links) {
      const [sa, sb] = [islands[a], islands[b]];
      const [ca, cb] = [place(sa.at), place(sb.at)];
      const [ra, rb] = [rim(sa, ca, cb), rim(sb, cb, ca)];
      if (Math.hypot(rb.x - ra.x, rb.y - ra.y) < 8) continue;
      lines.push(`<line x1="${f(ra.x)}" y1="${f(ra.y)}" x2="${f(rb.x)}" y2="${f(rb.y)}" stroke="#b9bccb" stroke-width="1.5" stroke-dasharray="6 5"/><circle cx="${f(ra.x)}" cy="${f(ra.y)}" r="2.5" fill="#b9bccb"/><circle cx="${f(rb.x)}" cy="${f(rb.y)}" r="2.5" fill="#b9bccb"/>`);
      const mid = { x: (ra.x + rb.x) / 2, y: (ra.y + rb.y) / 2 };
      const text = km(metres);
      const w = text.length * 7 + 14;
      pills.push(`<g><rect x="${f(mid.x - w / 2)}" y="${f(mid.y - 10)}" width="${w}" height="20" rx="10" fill="#fffdf8" stroke="#dcdfe8"/><text x="${f(mid.x)}" y="${f(mid.y + 4.5)}" text-anchor="middle" class="atlas-km">${text}</text></g>`);
    }
  }
  // A member going from one region to another: a dashed arc in their colour (under the islands' pins, over the land).
  const arcs: string[] = [];
  MEMBERS.forEach((m, k) => {
    const mine = PINGS.map((p, i) => ({ p, i })).filter(({ p }) => p.m === k).sort((a, b) => a.p.at.localeCompare(b.p.at));
    for (let n = 1; n < mine.length; n++) {
      if (atlas.regionOf.get(mine[n - 1].i) === atlas.regionOf.get(mine[n].i)) continue;
      const g = (i: number) => {
        const s = islands[atlas.regionOf.get(i)!];
        const q = place(s.at);
        const l = local(atlas, i);
        return { x: q.x - s.size / 2 + l.x, y: q.y - s.size / 2 + l.y };
      };
      const [a, b] = [g(mine[n - 1].i), g(mine[n].i)];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const c = { x: (a.x + b.x) / 2 - ((b.y - a.y) / len) * len * 0.2, y: (a.y + b.y) / 2 + ((b.x - a.x) / len) * len * 0.2 };
      arcs.push(`<path d="M${f(a.x)},${f(a.y)} Q${f(c.x)},${f(c.y)} ${f(b.x)},${f(b.y)}" fill="none" stroke="${m.colour}" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round" opacity="0.9"/>`);
    }
  });
  const groundOf = (s: Island) => {
    const q = place(s.at);
    return `<g transform="translate(${f(q.x - s.size / 2)} ${f(q.y - s.size / 2)})">${s.parts.length ? islandSvg(s, s.size) : `<ellipse cx="${s.size / 2}" cy="${s.size / 2}" rx="${s.size * 0.4}" ry="${s.size * 0.27}" fill="#e3e9f5"/>`}</g>`;
  };
  const marksOf = (s: Island) => {
    const q = place(s.at);
    return `<g transform="translate(${f(q.x - s.size / 2)} ${f(q.y - s.size / 2)})">${islandMarks(atlas, s)}</g>${label(q.x, q.y - s.size / 2 + Math.min(...s.points.map((p) => p.y)) * s.size - 44, s.name)}`;
  };
  return `<svg width="${f(atlas.W)}" height="${f(atlas.H)}" viewBox="0 0 ${f(atlas.W)} ${f(atlas.H)}" style="display:block"><defs><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter></defs>${land}${lines.join('')}${islands.map(groundOf).join('')}${arcs.join('')}${islands.map(marksOf).join('')}${pills.join('')}</svg>`;
}

/** The farthest two islands, for the header's one-line summary. */
const span = (atlas: Atlas) => {
  let best = { a: 0, b: 0, metres: 0 };
  atlas.islands.forEach((a, i) => atlas.islands.forEach((b, j) => j > i && metresApart(a, b) > best.metres && (best = { a: i, b: j, metres: metresApart(a, b) })));
  return best;
};

const rail = `<div class="rail"><span class="all">ALL</span>${MEMBERS.map((m) => `<span class="face" style="border-color:${m.colour}"><i style="background:${m.colour}"></i></span>`).join('')}</div>`;
const head = (atlas: Atlas, chip: boolean) => {
  const far = span(atlas);
  const summary = chip ? `<span class="chip"><i></i>직선거리 · 가장 먼 곳 ${atlas.islands[far.a].name.split(' ')[0]} ↔ ${atlas.islands[far.b].name.split(' ')[0]} ${km(far.metres)}</span>` : '';
  return `<div class="head"><span class="back">‹</span><div class="title"><b>${atlas.day.title}</b><small>TODAY</small>${summary}</div><span class="gear">⚙</span></div>`;
};
const phone = (id: string, title: string, note: string, atlas: Atlas, opts: { korea: boolean; links: boolean }) => `
<section>
  <h2>${title}</h2><p>${note}</p>
  <div class="phone"><div class="scroll" id="${id}">${canvas(atlas, opts)}</div>${head(atlas, opts.links)}${rail}</div>
</section>`;
const whole = (title: string, atlas: Atlas, opts: { korea: boolean; links: boolean }) =>
  `<section class="whole" style="width:${f(Math.max(375, atlas.W / 2))}px"><h2>${title}</h2><p>${atlas.islands.length}개 섬 · 캔버스 ${atlas.W.toFixed(0)}×${atlas.H.toFixed(0)}px = 폰 폭 ${(atlas.W / 375).toFixed(2)}배 · 높이 ${(atlas.H / 812).toFixed(2)}화면</p><div class="frame" style="width:${f(atlas.W / 2)}px;height:${f(atlas.H / 2)}px">${canvas(atlas, opts)}</div></section>`;

const nation = await build(NATION);
const metro = await build(METRO);

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Group Atlas Drafts</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Do+Hyeon&family=Oswald:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root { --bg:#fbf8f1; --surface:#fffdf8; --text:#2a3354; --muted:#979bab; --accent:#6c90d8; }
  body { margin:0; background:#e9e6de; color:var(--text); font-family:'Oswald','Do Hyeon',sans-serif; }
  main { display:flex; flex-wrap:wrap; gap:36px; padding:28px; align-items:flex-start; }
  section { width:375px; } h2 { font:28px 'Bebas Neue','Do Hyeon',sans-serif; margin:0; letter-spacing:.04em; } p { margin:4px 0 12px; font:14px 'Do Hyeon',sans-serif; color:#5d6480; min-height:40px; }
  .phone { position:relative; width:375px; height:740px; border-radius:28px; overflow:hidden; background:var(--bg); box-shadow:0 10px 30px rgba(42,51,84,.18); }
  .scroll { position:absolute; inset:0; overflow:auto; scrollbar-width:none; cursor:grab; touch-action:pan-x pan-y; } .scroll::-webkit-scrollbar{display:none} .scroll.is-drag{cursor:grabbing}
  .head { position:absolute; top:0; left:0; right:0; height:112px; display:flex; align-items:flex-start; justify-content:space-between; padding:14px 14px 0; box-sizing:border-box; pointer-events:none; background:linear-gradient(var(--bg) 62%, transparent); }
  .back { font:34px sans-serif; color:var(--muted); line-height:1; } .gear { width:40px; height:40px; border-radius:50%; background:var(--accent); color:#fff; display:grid; place-items:center; font-size:20px; }
  .title { text-align:center; padding-top:6px; display:flex; flex-direction:column; align-items:center; } .title b { display:block; font:20px 'Do Hyeon',sans-serif; } .title small { font:18px 'Bebas Neue',sans-serif; color:var(--muted); letter-spacing:.06em; }
  .chip { margin-top:4px; font:12px 'Do Hyeon',sans-serif; color:#7a7f95; display:flex; align-items:center; gap:6px; white-space:nowrap; }
  .chip i { width:18px; border-top:1.5px dashed #b9bccb; }
  .rail { position:absolute; left:0; right:0; bottom:0; padding:18px 0 28px; display:flex; gap:8px; justify-content:center; background:linear-gradient(transparent, var(--bg) 45%); pointer-events:none; }
  .rail .all { width:44px; height:44px; border-radius:50%; background:#fff; border:2px solid var(--accent); color:var(--accent); display:grid; place-items:center; font:15px 'Bebas Neue'; box-sizing:border-box; }
  .rail .face { width:44px; height:44px; border-radius:50%; background:#fff; border:3px solid; box-sizing:border-box; display:grid; place-items:center; } .rail .face i { width:14px; height:14px; border-radius:50%; }
  .atlas-name { font:15px 'Do Hyeon',sans-serif; fill:#5d6480; }
  .atlas-km { font:12px 'Oswald',sans-serif; fill:#6b7088; letter-spacing:.02em; }
  .whole .frame { overflow:hidden; border-radius:12px; background:var(--bg); box-shadow:0 4px 14px rgba(42,51,84,.12); }
  .whole .frame > svg { transform:scale(.5); transform-origin:0 0; }
</style></head><body><main>
${phone('a', 'A · 전국 — 흐린 한반도 + 섬', '지역이 전국에 흩어진 날. 한반도가 위치를 알려 줌.', nation, { korea: true, links: false })}
${phone('b', 'B · 전국 — 섬 + 거리 줄', '한반도 없이. 이웃한 섬끼리 직선거리(가장 짧게 잇는 줄만), 위에 가장 먼 두 곳.', nation, { korea: false, links: true })}
${phone('d', 'D · 수도권 — 섬 + 거리 줄', '한반도가 필요 없는 날(8곳이 서울 근교). 섬은 실제보다 벌어져 있으니 거리는 줄의 숫자로.', metro, { korea: false, links: true })}
${whole('B · 캔버스 전체 (½)', nation, { korea: false, links: true })}
${whole('D · 캔버스 전체 (½)', metro, { korea: false, links: true })}
</main>
<script>
  // Mouse drag-to-pan with a little glide (touch scrolls natively).
  for (const el of document.querySelectorAll('.scroll')) {
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    let drag = null, vx = 0, vy = 0, raf = 0;
    el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; cancelAnimationFrame(raf); drag = { x: e.clientX, y: e.clientY, t: performance.now() }; el.classList.add('is-drag'); el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => { if (!drag) return; const now = performance.now(), dx = e.clientX - drag.x, dy = e.clientY - drag.y, dt = Math.max(1, now - drag.t); el.scrollLeft -= dx; el.scrollTop -= dy; vx = dx / dt; vy = dy / dt; drag = { x: e.clientX, y: e.clientY, t: now }; });
    const end = () => { if (!drag) return; drag = null; el.classList.remove('is-drag'); const glide = () => { vx *= 0.94; vy *= 0.94; el.scrollLeft -= vx * 16; el.scrollTop -= vy * 16; if (Math.hypot(vx, vy) > 0.02) raf = requestAnimationFrame(glide); }; raf = requestAnimationFrame(glide); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
</script></body></html>`;

await mkdir('ui-shots', { recursive: true });
await mkdir('output/group-drafts-2026-11-02', { recursive: true });
await writeFile('ui-shots/atlas.html', html);
await writeFile('output/group-drafts-2026-11-02/atlas.html', html);
console.log('→ ui-shots/atlas.html, output/group-drafts-2026-11-02/atlas.html');
