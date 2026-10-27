// Scratch: three directions for a map that shows only what this app needs
// (where I am, my pins, the water, a few big lines, the neighbourhood's name),
// drawn on real data at the 4 places × 3 scales of `npm run shots -- mainmap`.
// npx vite-node scripts/_simple-variants.ts  ->  ui-shots/simple-variants.html
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import type { BaseMap, PolygonRings, RoadTier } from '../src/domain/baseMap';
import { shapeBaseMap } from '../src/domain/baseShapes';
import type { LonLat, MapViewport } from '../src/domain/districtMap';
import { parseAreas } from '../src/services/adminAreaService';
import { koreaMapLevelIndex, parseBaseTile, visibleKoreaTiles } from '../src/services/koreaMapService';
import type { AdminArea } from '../src/domain/adminAreas';

const W = 375, H = 700;
const ROOT = 'public/korea';

type View = MapViewport & { mpp: number; lat: number };
const view = (lon: number, lat: number, mpp: number): View => {
  const spanLon = (mpp * W) / (111320 * Math.cos((lat * Math.PI) / 180));
  const spanLat = (mpp * H) / 110540;
  return { bounds: { west: lon - spanLon / 2, east: lon + spanLon / 2, south: lat - spanLat / 2, north: lat + spanLat / 2 }, widthPx: W, mpp, lat };
};
const xy = (v: View, [lon, lat]: LonLat): [number, number] => [
  ((lon - v.bounds.west) / (v.bounds.east - v.bounds.west)) * W,
  ((v.bounds.north - lat) / (v.bounds.north - v.bounds.south)) * H,
];

// ---- data -------------------------------------------------------------------

const manifest = JSON.parse(readFileSync(`${ROOT}/base/manifest.json`, 'utf8')) as { levels: { name: string; step: number; tiles: string[] }[] };
function baseMap(v: View): BaseMap {
  const level = manifest.levels[koreaMapLevelIndex(v)];
  const out: BaseMap = { land: [], parks: [], roads: [] };
  for (const key of visibleKoreaTiles(level as never, v.bounds)) {
    const file = `${ROOT}/base/${level.name}/${key}.json`;
    if (!existsSync(file)) continue;
    const tile = parseBaseTile(JSON.parse(readFileSync(file, 'utf8')));
    if (!tile) continue;
    out.land.push(...tile.land); out.parks.push(...tile.parks); out.roads.push(...tile.roads);
  }
  return out;
}
const overlaps = (a: AdminArea['bbox'], b: AdminArea['bbox']) => a.west < b.east && a.east > b.west && a.south < b.north && a.north > b.south;
const readAreas = (p: string) => (existsSync(p) ? parseAreas(JSON.parse(readFileSync(p, 'utf8'))) ?? [] : []);
const sggAll = ['11', '41'].flatMap((s) => readAreas(`${ROOT}/admin/sgg/${s}.json`));
function areas(v: View) {
  const sgg = sggAll.filter((a) => overlaps(a.bbox, v.bounds));
  const dong = sgg.flatMap((g) => readAreas(`${ROOT}/admin/dong/${g.code}.json`)).filter((a) => overlaps(a.bbox, v.bounds));
  return { sgg, dong };
}

// ---- geometry ---------------------------------------------------------------

type P = [number, number];
function simplify(pts: P[], tol: number): P[] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let worst = -1, at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/** Each leg as a straight run then a 45° run, ends kept: the subway-diagram grammar. */
function octilinear(pts: P[]): P[] {
  const out: P[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = out[out.length - 1], [x1, y1] = pts[i];
    const dx = x1 - x0, dy = y1 - y0, d = Math.min(Math.abs(dx), Math.abs(dy));
    const mid: P = Math.abs(dx) > Math.abs(dy) ? [x1 - Math.sign(dx) * d, y0] : [x0, y1 - Math.sign(dy) * d];
    if (Math.hypot(mid[0] - x0, mid[1] - y0) > 0.5 && Math.hypot(x1 - mid[0], y1 - mid[1]) > 0.5) out.push(mid);
    out.push([x1, y1]);
  }
  return out;
}
const lineD = (pts: P[]) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L');
const polyD = (v: View, polys: PolygonRings[]) =>
  polys.map((rings) => rings.map((r) => lineD(r.map((q) => xy(v, q))) + 'Z').join('')).join('');
const pathLen = (pts: P[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const inside = ([x, y]: P, m = 0) => x > -m && x < W + m && y > -m && y < H + m;

function ringArea(r: P[]) { let s = 0; for (let i = 0; i < r.length; i++) { const [a, b] = r[i], [c, d] = r[(i + 1) % r.length]; s += a * d - c * b; } return s / 2; }
function centroid(r: P[]): P {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < r.length; i++) { const [x0, y0] = r[i], [x1, y1] = r[(i + 1) % r.length]; const f = x0 * y1 - x1 * y0; a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f; }
  return a ? [cx / (3 * a), cy / (3 * a)] : r[0];
}
function containsPt(r: P[], [x, y]: P) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** The screen point and size of an area's biggest piece. */
function areaPlace(v: View, a: AdminArea) {
  let best: P[] = [], size = 0;
  for (const poly of a.polygons) { const r = poly[0].map((q) => xy(v, q)); const s = Math.abs(ringArea(r)); if (s > size) { size = s; best = r; } }
  return { at: centroid(best), size, ring: best };
}

// ---- labels -----------------------------------------------------------------

type Box = [number, number, number, number];
const UI_BOXES: Box[] = [[0, 0, W, 80], [W - 70, 0, W, 210], [W / 2 - 80, H - 110, W / 2 + 80, H]];
/** Labels keep off the app's buttons and off the pins and my dot (the pins are what matter). */
function labeller(s: Scene) {
  const marks: Box[] = [...s.pins.map((p) => xy(s.v, [p.lon, p.lat])), xy(s.v, s.me)].map(([x, y]) => [x - 13, y - 32, x + 13, y + 9]);
  const taken: Box[] = [...UI_BOXES, ...marks];
  return (x: number, y: number, text: string, size: number, spacing = 0): boolean => {
    const w = [...text].reduce((s, ch) => s + (/[가-힣]/.test(ch) ? size * 0.92 : size * 0.55) + spacing, 0);
    const box: Box = [x - w / 2 - 4, y - size * 0.75 - 3, x + w / 2 + 4, y + size * 0.3 + 3];
    if (box[0] < 4 || box[2] > W - 4 || box[1] < 4 || box[3] > H - 4) return false;
    if (taken.some((t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1])) return false;
    taken.push(box); return true;
  };
}
const text = (x: number, y: number, s: string, size: number, fill: string, extra = '') =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" fill="${fill}" text-anchor="middle" ${extra}>${s}</text>`;

// ---- shared bits ------------------------------------------------------------

type Pin = { lon: number; lat: number; colour: string; name: string };
const PINS: Record<string, Pin[]> = {
  seongsu: [
    { lon: 127.0582, lat: 37.5447, colour: '#ec8177', name: '어니언 성수' },
    { lon: 127.0557, lat: 37.5431, colour: '#d4995c', name: '성수 갈비집' },
    { lon: 127.0539, lat: 37.5418, colour: '#a98bdb', name: '대림창고' },
    { lon: 127.0374, lat: 37.5444, colour: '#5fbda3', name: '서울숲' },
    { lon: 127.0396, lat: 37.5272, colour: '#ee89b6', name: '압구정 로데오' },
  ],
  jongno: [
    { lon: 126.9849, lat: 37.5709, colour: '#ec8177', name: '익선동 한옥' },
    { lon: 126.9918, lat: 37.5703, colour: '#d4995c', name: '광장시장' },
    { lon: 126.9768, lat: 37.5796, colour: '#5fbda3', name: '경복궁' },
    { lon: 126.9850, lat: 37.5826, colour: '#a98bdb', name: '북촌' },
  ],
  yangpyeong: [
    { lon: 127.4895, lat: 37.4913, colour: '#d4995c', name: '양평역 카페' },
    { lon: 127.4801, lat: 37.4952, colour: '#5fbda3', name: '물소리길' },
  ],
};
PINS.river = PINS.seongsu;

function pinsSvg(v: View, pins: Pin[], me: LonLat, show: (p: Pin, at: P) => string = () => '') {
  const meAt = xy(v, me);
  const dots = pins.map((p) => {
    const [x, y] = xy(v, [p.lon, p.lat]);
    if (!inside([x, y], 20)) return '';
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="M0 0 C-3 -6 -10 -10 -10 -17 A10 10 0 1 1 10 -17 C10 -10 3 -6 0 0Z" fill="${p.colour}" stroke="#fff" stroke-width="1.6"/><circle cy="-17" r="3.6" fill="#fff"/></g>${show(p, [x, y])}`;
  }).join('');
  return dots + `<circle cx="${meAt[0]}" cy="${meAt[1]}" r="14" fill="#6c90d8" opacity=".18"/><circle cx="${meAt[0]}" cy="${meAt[1]}" r="6.5" fill="#6c90d8" stroke="#fff" stroke-width="2.5"/>`;
}
/** The app's own chrome, so each draft is judged under it. */
const chrome = `<rect x="12" y="12" width="290" height="44" rx="22" fill="#fffdf8" opacity=".97"/><circle cx="335" cy="34" r="22" fill="#f1ece0"/><circle cx="335" cy="88" r="20" fill="#fffdf8"/><circle cx="335" cy="138" r="20" fill="#fffdf8"/><circle cx="${W / 2}" cy="${H - 58}" r="34" fill="#6c90d8"/><circle cx="${W / 2 + 62}" cy="${H - 44}" r="18" fill="#fffdf8"/>`;

type Scene = { v: View; base: BaseMap; land: PolygonRings[]; sgg: AdminArea[]; dong: AdminArea[]; pins: Pin[]; me: LonLat; scale: Scale };
type Scale = 'gu' | 'dong' | 'block';

/**
 * Road pieces of one tier chained end to end (the data is cut per tile and
 * per OSM way), so a long avenue is one line to straighten, not a dozen stubs.
 */
function chain(lines: P[][]): P[][] {
  const key = ([x, y]: P) => `${Math.round(x / 2)},${Math.round(y / 2)}`;
  const open = new Set(lines.map((_, i) => i));
  const ends = new Map<string, number[]>();
  lines.forEach((l, i) => { for (const p of [l[0], l[l.length - 1]]) ends.set(key(p), [...(ends.get(key(p)) ?? []), i]); });
  const out: P[][] = [];
  const grow = (line: P[], atEnd: boolean) => {
    for (;;) {
      const tip = atEnd ? line[line.length - 1] : line[0];
      const next = (ends.get(key(tip)) ?? []).find((j) => open.has(j));
      if (next === undefined) return line;
      open.delete(next);
      let piece = lines[next];
      if (key(piece[0]) !== key(tip)) piece = [...piece].reverse();
      line = atEnd ? [...line, ...piece.slice(1)] : [...[...piece].reverse(), ...line.slice(1)];
    }
  };
  for (const i of [...open]) {
    if (!open.has(i)) continue;
    open.delete(i);
    out.push(grow(grow(lines[i], true), false));
  }
  return out;
}

/** Points along a line every `step` px. */
function sample(pts: P[], step: number): P[] {
  const out: P[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step);
    for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}
/**
 * Big roads, chained, kept when long on screen, longest first up to `count`;
 * a line that mostly runs along one already kept (the other carriageway, a
 * side road) is dropped: the few lines people steer by.
 */
function skeleton(s: Scene, tiers: RoadTier[], tol: number, minLen: number, count = Infinity, near = 0) {
  const all = tiers.flatMap((tier) =>
    chain(s.base.roads.filter((r) => r.tier === tier).map((r) => r.path.map((q) => xy(s.v, q))))
      .map((pts) => ({ tier, pts: simplify(pts, tol), len: pathLen(pts.filter((p) => inside(p, 20))) }))
      .filter((r) => r.pts.some((p) => inside(p, 40)) && r.len >= minLen));
  all.sort((a, b) => a.tier - b.tier || b.len - a.len);
  const kept: { tier: RoadTier; pts: P[]; dots: P[] }[] = [];
  for (const r of all) {
    if (kept.length >= count) break;
    const dots = sample(r.pts, 6).filter((p) => inside(p));
    if (near && dots.length) {
      const close = dots.filter((p) => kept.some((k) => k.dots.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < near))).length;
      if (close / dots.length > 0.5) continue;
    }
    kept.push({ tier: r.tier, pts: r.pts, dots });
  }
  return kept;
}

// ---- the three directions ---------------------------------------------------

const C = {
  paper: '#f7f2e8', water: '#cfe0f4', waterEdge: '#b7cde9', park: '#dfecd6', ink: '#2a3354', faint: '#9a927f', accent: '#6c90d8',
};
const svgWrap = (bg: string, body: string, defs = '') =>
  `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs><rect width="${W}" height="${H}" fill="${bg}"/>${body}${chrome}</svg>`;
const groundSvg = (s: Scene, land: string, parks: string | null, coast = true) =>
  (coast ? `<path d="${polyD(s.v, s.land)}" fill="none" stroke="${C.waterEdge}" stroke-width="3" stroke-linejoin="round"/>` : '') +
  `<path d="${polyD(s.v, s.land)}" fill="${land}" fill-rule="evenodd"/>` +
  (parks ? `<path d="${polyD(s.v, s.base.parks.filter((p) => Math.abs(ringArea(p[0].map((q) => xy(s.v, q)))) > (s.scale === 'gu' ? 600 : 250)))}" fill="${parks}" fill-rule="evenodd"/>` : '');

type Variant = { id: string; title: string; why: string; draw: (s: Scene) => string };
let clipCount = 0;
const VARIANTS: Variant[] = [
  {
    id: 'A', title: 'A. 노선도형 뼈대',
    why: '큰길만 골라 가로·세로·45°로 펴서 굵기 두 단계로. 강은 그대로 두고 동은 작은 이름만. 지하철 노선도처럼 "어느 줄 옆인가"로 위치를 읽음. 골목 축척에선 줄이 적어 허전할 수 있음.',
    draw: (s) => {
      const cfg = {
        gu: { tiers: [1, 2] as RoadTier[], tol: 30, min: 160, count: 9 },
        dong: { tiers: [1, 2, 3] as RoadTier[], tol: 18, min: 120, count: 12 },
        block: { tiers: [2, 3, 4] as RoadTier[], tol: 10, min: 90, count: 12 },
      }[s.scale];
      const roads = skeleton(s, cfg.tiers, cfg.tol, cfg.min, cfg.count, 22);
      const width = (t: RoadTier) => (t <= Math.min(...cfg.tiers) ? 7 : 4);
      const lines = (casing: boolean) => roads.sort((a, b) => b.tier - a.tier).map((r) => {
        const d = lineD(octilinear(r.pts));
        return `<path d="${d}" fill="none" stroke="${casing ? '#e3dac8' : '#ffffff'}" stroke-width="${width(r.tier) + (casing ? 2.5 : 0)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }).join('');
      const label = labeller(s);
      const names = s.dong.map((a) => ({ a, ...areaPlace(s.v, a) })).filter((d) => d.size > 2500).sort((a, b) => b.size - a.size)
        .map((d) => (label(d.at[0], d.at[1], d.a.name, 11) ? text(d.at[0], d.at[1], d.a.name, 11, C.faint, 'font-family="Do Hyeon"') : '')).join('');
      return svgWrap(C.water, groundSvg(s, C.paper, C.park) + lines(true) + lines(false) + names + pinsSvg(s.v, s.pins, s.me));
    },
  },
  {
    id: 'B', title: 'B. 글자 중심 동네 지도',
    why: '길·경계를 거의 지우고 동네 이름을 크게, 글자 간격을 넓혀 잡지 지도처럼. 축소하면 구 이름, 확대하면 지금 동 이름이 바탕에 크게 깔림. 여행 앱 말투와 가장 잘 맞음. 길을 찾는 정보는 가장 적음.',
    draw: (s) => {
      const hair = skeleton(s, s.scale === 'block' ? [2, 3] : [1], 4, 20)
        .map((r) => `<path d="${lineD(r.pts)}" fill="none" stroke="#e6dece" stroke-width="${s.scale === 'block' ? 6 : 1.4}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
      const label = labeller(s);
      let names = '';
      const font = 'font-family="Do Hyeon"';
      if (s.scale === 'gu') {
        for (const g of s.sgg.map((a) => ({ a, ...areaPlace(s.v, a) })).sort((a, b) => b.size - a.size))
          if (label(g.at[0], g.at[1], g.a.name, 24, 6)) names += text(g.at[0], g.at[1], g.a.name, 24, C.ink, `${font} letter-spacing="6" opacity=".72"`);
        for (const d of s.dong.map((a) => ({ a, ...areaPlace(s.v, a) })).filter((d) => d.size > 3000).sort((a, b) => b.size - a.size))
          if (label(d.at[0], d.at[1], d.a.name, 11)) names += text(d.at[0], d.at[1], d.a.name, 11, C.faint, font);
      } else {
        const here = s.dong.find((a) => a.polygons.some((p) => containsPt(p[0].map((q) => xy(s.v, q)), xy(s.v, s.me))));
        if (here) {
          const big = s.scale === 'block' ? 54 : 30;
          const [x, y] = s.scale === 'block' ? [W / 2, H * 0.42] : areaPlace(s.v, here).at;
          label(x, y, here.name, big, 10);
          names += text(x, y, here.name, big, C.ink, `${font} letter-spacing="10" opacity="${s.scale === 'block' ? 0.12 : 0.75}"`);
        }
        const size = s.scale === 'block' ? 15 : 15;
        for (const d of s.dong.filter((a) => a !== here).map((a) => ({ a, ...areaPlace(s.v, a) })).sort((a, b) => b.size - a.size))
          if (label(d.at[0], d.at[1], d.a.name, size, 3)) names += text(d.at[0], d.at[1], d.a.name, size, C.faint, `${font} letter-spacing="3"`);
      }
      return svgWrap(C.water, groundSvg(s, C.paper, C.park) + hair + names + pinsSvg(s.v, s.pins, s.me));
    },
  },
  {
    id: 'C', title: 'C. 지금 동네 하나만',
    why: '평범한 무채색 지도(흰 길·초록 공원·파란 물) 위에 내가 있는 동 하나만 강조색 옅은 면 + 테두리. 다른 동은 아무것도 안 칠함. 익숙해서 길 찾기 쉽고 "여기가 어디"가 한눈에. 개성은 가장 약함.',
    draw: (s) => {
      const widths: Record<RoadTier, number> = { 1: 7, 2: 6, 3: 4, 4: 2.5, 5: 1.2 };
      const tiers: RoadTier[] = { gu: [1], dong: [1, 2], block: [1, 2, 3, 4, 5] }[s.scale] as RoadTier[];
      const scaleK = s.scale === 'gu' ? 0.45 : s.scale === 'dong' ? 0.7 : 1.4;
      const roads = s.base.roads.filter((r) => tiers.includes(r.tier)).sort((a, b) => b.tier - a.tier)
        .filter((r) => r.path.some((q) => inside(xy(s.v, q), 30)))
        .map((r) => `<path d="${lineD(simplify(r.path.map((q) => xy(s.v, q)), 1.2))}" fill="none" stroke="#ffffff" stroke-width="${(widths[r.tier] * scaleK).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
      const here = s.dong.find((a) => a.polygons.some((p) => containsPt(p[0].map((q) => xy(s.v, q)), xy(s.v, s.me))));
      let focus = '';
      const label = labeller(s);
      if (here) {
        const d = polyD(s.v, here.polygons);
        // Clipped to the land: a 동 that reaches into the river should not paint the water.
        const clip = `land${++clipCount}`;
        focus = `<clipPath id="${clip}"><path d="${polyD(s.v, s.land)}" clip-rule="evenodd"/></clipPath><path d="${d}" clip-path="url(#${clip})" fill="${C.accent}" fill-opacity=".14" stroke="${C.accent}" stroke-opacity=".55" stroke-width="2" stroke-linejoin="round"/>`;
        const p = areaPlace(s.v, here);
        const at: P = inside(p.at, -40) ? p.at : [W / 2, 110];
        const tries: P[] = [[0, 0], [0, 26], [0, -40], [40, 14], [-40, 14], [0, 52], [0, -66]];
        const [x, y] = tries.map(([dx, dy]): P => [at[0] + dx, at[1] + dy]).find(([tx, ty]) => label(tx, ty, here.name, 16, 2)) ?? at;
        focus += text(x, y, here.name, 16, C.accent, 'font-family="Do Hyeon" letter-spacing="2" stroke="#fff" stroke-width="3" paint-order="stroke"');
      }
      return svgWrap(C.water, groundSvg(s, '#f2efe9', '#d8ead0', false) + roads + focus + pinsSvg(s.v, s.pins, s.me));
    },
  },
];

// ---- sheet ------------------------------------------------------------------

const PLACES: Record<string, { name: string; at: LonLat }> = {
  seongsu: { name: '성수', at: [127.056, 37.544] },
  river: { name: '한강', at: [127.04, 37.535] },
  jongno: { name: '종로', at: [126.99, 37.5705] },
  yangpyeong: { name: '양평', at: [127.4875, 37.4917] },
};
const SCALES: Record<Scale, { name: string; mpp: number }> = { gu: { name: '구', mpp: 40 }, dong: { name: '동', mpp: 12 }, block: { name: '골목', mpp: 1.5 } };

let html = `<!doctype html><meta charset="utf-8"><title>단순 지도 시안</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Do+Hyeon&display=swap">
<style>body{margin:0;padding:24px;background:#ebe6dc;font-family:'Do Hyeon',sans-serif;color:#2a3354}
h1{font-size:28px;margin:0 0 6px}h2{font-size:22px;margin:28px 0 4px}p{margin:0 0 12px;max-width:900px;font-size:15px;line-height:1.5;font-family:system-ui,sans-serif}
.grid{display:grid;grid-template-columns:repeat(auto-fill,205px);gap:14px;justify-content:start}.cell{flex:none}.cell b{display:block;font-size:14px;margin:0 0 4px;font-weight:400;color:#6b6457}
svg{width:205px;height:auto;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.12);display:block}</style>
<h1>필요한 정보만 담은 지도 — 세 방향</h1><p>4곳 × 3축척, 실제 땅·물·공원·길·행정동 데이터. 핀·내 위치·앱 버튼 자리는 같게 그려 둠.</p>`;

const scenes = new Map<string, Scene>();
for (const [pk, place] of Object.entries(PLACES)) for (const [sk, scale] of Object.entries(SCALES) as [Scale, { mpp: number }][]) {
  const v = view(place.at[0], place.at[1], scale.mpp);
  const base = baseMap(v);
  const land = shapeBaseMap(base, v).land;
  scenes.set(`${pk}/${sk}`, { v, base, land, ...areas(v), pins: PINS[pk] ?? [], me: place.at, scale: sk });
}
for (const variant of VARIANTS) {
  html += `<h2>${variant.title}</h2><p>${variant.why}</p><div class="grid">`;
  for (const [pk, place] of Object.entries(PLACES))
    for (const [sk, scale] of Object.entries(SCALES)) html += `<div class="cell"><b>${place.name} · ${scale.name}</b>${variant.draw(scenes.get(`${pk}/${sk}`)!)}</div>`;
  html += '</div>';
}
writeFileSync('ui-shots/simple-variants.html', html);
console.log('ui-shots/simple-variants.html', Math.round(html.length / 1024), 'KB');
