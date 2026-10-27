// Scratch: three more directions for a map that shows only what this app
// needs, now without any text (names become shapes, icons or texture), drawn
// on real data at the 4 places × 3 scales of `npm run shots -- mainmap`.
// npx vite-node scripts/_textless-variants.ts  ->  ui-shots/textless-variants.html
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import type { BaseMap, PolygonRings, RoadTier } from '../src/domain/baseMap';
import { shapeBaseMap } from '../src/domain/baseShapes';
import { joinRoads } from '../src/domain/roadStrokes';
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
/** What kind of street life a place is: the data's 64 kinds folded into the few a person reads a neighbourhood by. */
type Kind = 'cafe' | 'food' | 'drink' | 'shop' | 'stay';
const KIND_OF = Object.fromEntries([
  ...['cafe', 'dessert', 'bakery', 'donut', 'icecream', 'study_cafe', 'comic_cafe'].map((k) => [k, 'cafe']),
  ...['korean', 'restaurant', 'chinese', 'japanese', 'western', 'noodle', 'seafood', 'meat', 'chicken', 'pizza', 'burger', 'buffet', 'snack', 'sandwich', 'world'].map((k) => [k, 'food']),
  ...['bar', 'pub', 'club', 'drink', 'liquor', 'karaoke'].map((k) => [k, 'drink']),
  ...['shop', 'gift_shop', 'bookstore', 'jewelry', 'florist', 'music_store', 'photo_studio', 'salon', 'pet_shop', 'bike_shop'].map((k) => [k, 'shop']),
  ...['hotel', 'motel', 'pension', 'camping'].map((k) => [k, 'stay']),
]) as Record<string, Kind>;
function spots(v: View, sgg: AdminArea[]): Spot[] {
  const out: Spot[] = [];
  for (const g of sgg) {
    const file = `${ROOT}/places/${g.code}.json`;
    if (!existsSync(file)) continue;
    const data = JSON.parse(readFileSync(file, 'utf8')) as { k: string[]; r: [string, number, number, number][] };
    for (const [, lon, lat, k] of data.r) {
      const kind = KIND_OF[data.k[k]];
      const at = xy(v, [lon / 1e5, lat / 1e5]);
      if (kind && inside(at, 30)) out.push({ at, kind });
    }
  }
  return out;
}
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

type Spot = { at: P; kind: Kind };
type Scene = { v: View; base: BaseMap; land: PolygonRings[]; sgg: AdminArea[]; dong: AdminArea[]; pins: Pin[]; me: LonLat; scale: Scale; spots: Spot[] };
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

const svgWrap = (bg: string, body: string, defs = '') =>
  `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs><rect width="${W}" height="${H}" fill="${bg}"/>${body}${chrome}</svg>`;

/** Corner cutting (Chaikin), twice: a straightened line with soft bends, like a toy road. */
function soften(pts: P[], times = 2): P[] {
  let line = pts;
  for (let t = 0; t < times && line.length > 2; t++) {
    const next: P[] = [line[0]];
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, y0] = line[i], [x1, y1] = line[i + 1];
      next.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    next.push(line[line.length - 1]);
    line = next;
  }
  return line;
}

/** The roads each scale keeps, and how wide (px): wide enough to read as roads, few enough to stay calm. */
const ROADS: Record<Scale, { tiers: RoadTier[]; tol: number; min: number; near: number; width: Partial<Record<RoadTier, number>> }> = {
  gu: { tiers: [1], tol: 12, min: 200, near: 16, width: { 1: 4.5 } },
  dong: { tiers: [1, 2, 3], tol: 4, min: 36, near: 11, width: { 1: 10, 2: 7.5, 3: 4.5 } },
  block: { tiers: [2, 3, 4, 5], tol: 2, min: 12, near: 0, width: { 2: 15, 3: 11, 4: 7, 5: 3 } },
};
function toyRoads(s: Scene, colour: string, casing: string | null, k = 1) {
  const cfg = ROADS[s.scale];
  const roads = skeleton(s, cfg.tiers, cfg.tol, cfg.min, Infinity, cfg.near).sort((a, b) => b.tier - a.tier);
  const draw = (extra: number, stroke: string) => roads.map((r) =>
    `<path d="${lineD(soften(r.pts))}" fill="none" stroke="${stroke}" stroke-width="${((cfg.width[r.tier] ?? 2) * k + extra).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return (casing ? draw(2.5, casing) : '') + draw(0, colour);
}
/**
 * The same roads joined into whole strokes first (domain/roadStrokes), then
 * chosen by tier and length: a kept road is drawn end to end, so nothing is
 * cut off midway. Each tier has its own minimum length: the bigger the road,
 * the shorter it may be and still be drawn, as it holds the picture together.
 */
const JOINED: Record<Scale, { tol: number; min: Partial<Record<RoadTier, number>>; width: Partial<Record<RoadTier, number>> }> = {
  gu: { tol: 8, min: { 1: 60, 2: 280 }, width: { 1: 4.5, 2: 2.6 } },
  dong: { tol: 4, min: { 1: 30, 2: 50, 3: 120 }, width: { 1: 10, 2: 7.5, 3: 4.5 } },
  block: { tol: 2, min: { 2: 10, 3: 10, 4: 30, 5: 50 }, width: { 2: 15, 3: 11, 4: 7, 5: 3 } },
};
function joinedRoads(s: Scene, colour: string, casing: string) {
  const cfg = JOINED[s.scale];
  const tiers = Object.keys(cfg.min).map(Number) as RoadTier[];
  const pieces = s.base.roads.filter((r) => tiers.includes(r.tier)).map((r) => ({ tier: r.tier, path: r.path.map((q) => xy(s.v, q)) }));
  const strokes = joinRoads(pieces)
    .filter((r) => r.length >= (cfg.min[r.tier] ?? Infinity) && r.path.some((p) => inside(p, 20)))
    .sort((a, b) => b.tier - a.tier);
  const paths = strokes.map((r) => ({ tier: r.tier, d: lineD(soften(simplify(r.path, cfg.tol))) }));
  const draw = (extra: number, stroke: string) => paths.map((r) =>
    `<path d="${r.d}" fill="none" stroke="${stroke}" stroke-width="${((cfg.width[r.tier] ?? 2) + extra).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return draw(2.5, casing) + draw(0, colour);
}
/** Parks big enough to matter at this scale. */
function parksOf(s: Scene) {
  return s.base.parks.filter((p) => Math.abs(ringArea(p[0].map((q) => xy(s.v, q)))) > (s.scale === 'gu' ? 500 : 200));
}
/** Land with a deeper coast line, parks padded round so they read as soft blobs. */
function ground(s: Scene, c: { land: string; coast: string; park: string }) {
  const land = polyD(s.v, s.land);
  const parks = polyD(s.v, parksOf(s));
  return `<path d="${land}" fill="none" stroke="${c.coast}" stroke-width="5" stroke-linejoin="round"/><path d="${land}" fill="${c.land}" fill-rule="evenodd"/>` +
    `<path d="${parks}" fill="${c.park}" stroke="${c.park}" stroke-width="5" stroke-linejoin="round" fill-rule="evenodd"/>`;
}
/** A few trees dotted in the parks (zoomed in), so green reads as a park, not a paint mark. */
function trees(s: Scene, fill: string) {
  if (s.scale === 'gu') return '';
  const step = s.scale === 'dong' ? 16 : 26, r = s.scale === 'dong' ? 3.2 : 6;
  const rings = parksOf(s).map((p) => p[0].map((q) => xy(s.v, q)));
  let out = '';
  for (let y = step / 2, row = 0; y < H; y += step, row++) for (let x = (row % 2) * (step / 2) + step / 2; x < W; x += step)
    if (rings.some((ring) => containsPt(ring, [x, y]))) out += `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
  return out;
}

/** Chaikin corner cutting on a closed ring: a simplified outline with soft, toy-like bends. */
function softenRing(ring: P[], times = 3): P[] {
  let line = ring;
  for (let t = 0; t < times && line.length > 2; t++) {
    const next: P[] = [];
    for (let i = 0; i < line.length; i++) {
      const [x0, y0] = line[i], [x1, y1] = line[(i + 1) % line.length];
      next.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    line = next;
  }
  return line;
}
/** Polygons drawn the toy way: outlines straightened, then rounded; rings too small to read are dropped. */
function softRings(s: Scene, polys: PolygonRings[], tol: number, minArea: number): P[][] {
  const out: P[][] = [];
  for (const rings of polys) for (const ring of rings) {
    const screen = ring.map((q) => xy(s.v, q));
    if (Math.abs(ringArea(screen)) < minArea) continue;
    // Split at the point farthest from the start: Douglas-Peucker cannot measure against a zero-length chord.
    let far = 0;
    screen.forEach(([x, y], i) => { if (Math.hypot(x - screen[0][0], y - screen[0][1]) > Math.hypot(screen[far][0] - screen[0][0], screen[far][1] - screen[0][1])) far = i; });
    const simple = [...simplify(screen.slice(0, far + 1), tol), ...simplify([...screen.slice(far), screen[0]], tol).slice(1, -1)];
    if (simple.length >= 3) out.push(softenRing(simple));
  }
  return out;
}
const ringsD = (rings: P[][]) => rings.map((r) => lineD(r) + 'Z').join('');
const SOFT: Record<Scale, { tol: number; land: number; park: number }> = {
  gu: { tol: 6, land: 400, park: 700 },
  dong: { tol: 5, land: 250, park: 350 },
  block: { tol: 4, land: 200, park: 250 },
};
/** Water as a toy board draws it: a deeper sea with a pale shallow band along every shore. */
function toyGround(s: Scene) {
  const k = SOFT[s.scale];
  const land = ringsD(softRings(s, s.land, k.tol, k.land));
  const parkRings = softRings(s, parksOf(s), k.tol * 1.6, k.park);
  const trees = s.scale === 'gu' ? '' : (() => {
    const step = s.scale === 'dong' ? 16 : 26, r = s.scale === 'dong' ? 3.2 : 6;
    let out = '';
    for (let y = step / 2, row = 0; y < H; y += step, row++) for (let x = (row % 2) * (step / 2) + step / 2; x < W; x += step)
      if (parkRings.some((ring) => containsPt(ring, [x, y]))) out += `<circle cx="${x}" cy="${y}" r="${r}" fill="${TOY.tree}"/>`;
    return out;
  })();
  return `<path d="${land}" fill="none" stroke="${TOY.shallow}" stroke-width="${s.scale === 'gu' ? 9 : 14}" stroke-linejoin="round"/>` +
    `<path d="${land}" fill="${TOY.land}" fill-rule="evenodd"/>` +
    `<path d="${ringsD(parkRings)}" fill="${TOY.park}" stroke="${TOY.park}" stroke-width="6" stroke-linejoin="round" fill-rule="evenodd"/>` + trees;
}
/** Each 동 as a soft board tile: only the seams between them, a shade of the land, kept off the water. */
function toyTiles(s: Scene, clip: string) {
  const k = SOFT[s.scale];
  // Zoomed out the 동 are pebbles; the 구 are the tiles there.
  const areas = s.scale === 'gu' ? s.sgg : s.dong;
  const tiles = ringsD(areas.flatMap((a) => softRings(s, a.polygons.map((p) => [p[0]]), k.tol * 1.4, 300)));
  return `<g clip-path="url(#${clip})"><path d="${tiles}" fill="none" stroke="${TOY.seam}" stroke-width="${s.scale === 'gu' ? 3 : 3.5}" stroke-linejoin="round"/></g>`;
}

// Small line icons (24 units): the street life a 동 is known for.
const ICON: Record<Kind, string> = {
  cafe: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v3M12 3.5v3',
  food: 'M7 3v7M5 3v5a2 2 0 0 0 4 0V3M7 10v11M16.5 3c-2.2 2-2.2 7 0 8.5V21',
  drink: 'M5 4h14l-7 8zM12 12v8M8 20h8',
  shop: 'M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0',
  stay: 'M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 11.5a1.5 1.5 0 1 0 0-.01',
};
const KIND_COLOUR: Record<Kind, string> = { cafe: '#b98a5e', food: '#d97f6c', drink: '#8f7cc4', shop: '#5f9fb5', stay: '#7aa86f' };
const icon = (kind: Kind, x: number, y: number, size: number, ink: string, badge: string) =>
  `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(size * 0.85).toFixed(1)}" fill="${badge}"/>` +
  `<path d="${ICON[kind]}" transform="translate(${(x - size / 2).toFixed(1)} ${(y - size / 2).toFixed(1)}) scale(${(size / 24).toFixed(3)})" fill="none" stroke="${ink}" stroke-width="${((1.6 * 24) / size).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** The kind a 동 stands out for: most over-represented against the whole screen, with enough places to mean it. */
function character(s: Scene, ring: P[], all: Record<Kind, number>, total: number): { kind: Kind; lift: number } | null {
  const box = ring.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
  const here: Record<Kind, number> = { cafe: 0, food: 0, drink: 0, shop: 0, stay: 0 };
  let n = 0;
  for (const p of s.spots) if (p.at[0] >= box[0] && p.at[0] <= box[2] && p.at[1] >= box[1] && p.at[1] <= box[3] && containsPt(ring, p.at)) { here[p.kind]++; n++; }
  if (n < 12) return null;
  let best: Kind | null = null, lift = 1.5;
  // Lodging is left out: motels are everywhere and are not what a 동 is known for.
  for (const k of (Object.keys(here) as Kind[]).filter((k) => k !== 'stay')) {
    if (here[k] < 4) continue;
    const l = here[k] / n / (all[k] / total);
    if (l > lift) { lift = l; best = k; }
  }
  return best ? { kind: best, lift } : null;
}

/** A place free of the app's buttons, the pins and earlier marks. */
function spacer(s: Scene) {
  const taken: Box[] = [...UI_BOXES, ...[...s.pins.map((p) => xy(s.v, [p.lon, p.lat])), xy(s.v, s.me)].map(([x, y]): Box => [x - 13, y - 32, x + 13, y + 9])];
  return ([x, y]: P, r: number) => {
    const b: Box = [x - r, y - r, x + r, y + r];
    if (b[0] < 4 || b[2] > W - 4 || b[1] < 4 || b[3] > H - 4 || taken.some((t) => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1])) return false;
    taken.push(b);
    return true;
  };
}

const TOY = { water: '#9cc4ea', shallow: '#bcd9f2', seam: '#e6d6b4', land: '#f3ead8', coast: '#86b0dd', park: '#cfe4bd', tree: '#b5d6a0', road: '#ffffff', casing: '#e2d5bc' };
const toyBase = (s: Scene) => ground(s, TOY) + trees(s, TOY.tree) + toyRoads(s, TOY.road, TOY.casing);

/** E's marks: what each 동 is known for (or, zoomed in, each cluster of one kind). */
function neighbourhoodMarks(s: Scene): string {
  let marks = '';
  const free = spacer(s);
  // Quiet badges (a shade of the land, ink icon), so they read as the ground's character, not as more pins.
  const badge = '#e2d0aa', ink = '#5e4f36';
  if (s.scale === 'block') {
    // Zoomed in, a 동 is the whole screen: mark the clusters instead, where one kind gathers.
    const cell = 56, groups = new Map<string, Spot[]>();
    for (const p of s.spots) if (inside(p.at)) { const k = `${Math.floor(p.at[0] / cell)},${Math.floor(p.at[1] / cell)}`; groups.set(k, [...(groups.get(k) ?? []), p]); }
    const found = [...groups.values()].filter((g) => g.length >= 5).map((g) => {
      const count: Record<Kind, number> = { cafe: 0, food: 0, drink: 0, shop: 0, stay: 0 };
      for (const p of g) count[p.kind]++;
      const kind = (Object.keys(count) as Kind[]).filter((k) => k !== 'stay').sort((x, y) => count[y] - count[x])[0];
      const at: P = [g.reduce((t, p) => t + p.at[0], 0) / g.length, g.reduce((t, p) => t + p.at[1], 0) / g.length];
      return { kind, at, n: g.length };
    }).sort((x, y) => y.n - x.n).slice(0, 7);
    for (const f of found) if (free(f.at, 16)) marks += icon(f.kind, f.at[0], f.at[1], 18, ink, badge);
  } else {
    const all: Record<Kind, number> = { cafe: 0, food: 0, drink: 0, shop: 0, stay: 0 };
    for (const p of s.spots) all[p.kind]++;
    const size = s.scale === 'gu' ? 14 : 18;
    const picked = s.dong.map((a) => areaPlace(s.v, a))
      .filter((place) => place.size >= (s.scale === 'gu' ? 900 : 2500) && inside(place.at))
      .map((place) => ({ place, c: character(s, place.ring, all, s.spots.length) }))
      .filter((x) => x.c).sort((x, y) => y.c!.lift - x.c!.lift).slice(0, s.scale === 'gu' ? 9 : 6);
    for (const { place, c } of picked) if (free(place.at, size)) marks += icon(c!.kind, place.at[0], place.at[1], size, ink, badge);
  }
  return marks;
}

type Variant = { id: string; title: string; why: string; draw: (s: Scene) => string };
let maskCount = 0;
const VARIANTS: Variant[] = [
  {
    id: 'D', title: 'D. 장난감 길 (보드게임 판)',
    why: '실제 길을 골라 부드럽게 휜 굵은 흰 띠로, 땅은 따뜻한 종이, 물은 또렷한 파랑, 공원은 둥근 초록에 나무 점. 글자 없이 "길이 이렇게 이어진다"는 지도의 기본은 남기고, 질감은 보드게임 판처럼. 노선도보다 지도 같고, 실제 지도보다 단순함.',
    draw: (s) => svgWrap(TOY.water, toyBase(s) + pinsSvg(s.v, s.pins, s.me)),
  },
  {
    id: 'E', title: 'E. 동네 아이콘',
    why: 'D 위에 이름 대신 그 동네가 무엇으로 유명한지를 아이콘으로: 다른 곳보다 유난히 많은 가게 종류(카페·밥집·술집·가게·숙소)가 뚜렷한 동만, 땅색 배지에 옅은 아이콘이라 핀과 안 다툼. 확대하면 가게가 모인 골목에 같은 아이콘. "여기는 카페 동네"를 글 없이 읽음.',
    draw: (s) => svgWrap(TOY.water, toyBase(s) + neighbourhoodMarks(s) + pinsSvg(s.v, s.pins, s.me)),
  },
  {
    id: 'F', title: 'F. 점묘 (사람 사는 밀도)',
    why: '땅 전체를 망점으로 찍고, 가게가 많은 곳일수록 점이 굵게. 길은 점을 지우는 선으로 드러남. 번화가·주택가·산이 글 없이 질감으로 보이고, 인쇄물 같은 개성이 있음. 대신 정확한 길은 덜 또렷함.',
    draw: (s) => {
      const step = { gu: 6, dong: 7, block: 10 }[s.scale];
      const reach = { gu: 9, dong: 16, block: 34 }[s.scale];
      // Places counted into coarse buckets; each dot sums the buckets around it.
      const cols = Math.ceil(W / reach) + 2, rows = Math.ceil(H / reach) + 2;
      const bucket = new Float32Array(cols * rows);
      for (const p of s.spots) {
        const c = Math.floor(p.at[0] / reach) + 1, r = Math.floor(p.at[1] / reach) + 1;
        if (c >= 0 && c < cols && r >= 0 && r < rows) bucket[r * cols + c]++;
      }
      const density = (x: number, y: number) => {
        const c = Math.floor(x / reach) + 1, r = Math.floor(y / reach) + 1;
        let sum = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++)
          if (r + dr >= 0 && r + dr < rows && c + dc >= 0 && c + dc < cols) sum += bucket[(r + dr) * cols + c + dc] * (dr || dc ? 0.5 : 1);
        return sum;
      };
      const grid: P[] = [];
      for (let y = step / 2, row = 0; y < H; y += step, row++) for (let x = step / 2 + (row % 2) * (step / 2); x < W; x += step) grid.push([x, y]);
      const values = grid.map(([x, y]) => density(x, y));
      const ref = Math.max(1, [...values].sort((a, b) => a - b)[Math.floor(values.length * 0.995)]);
      const maxR = step * 0.42, minR = step * 0.08;
      const dots = grid.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(minR + (maxR - minR) * Math.sqrt(Math.min(1, values[i] / ref))).toFixed(2)}"/>`).join('');
      const mask = `land${++maskCount}`;
      const landD = polyD(s.v, s.land);
      return svgWrap('#cfe0f4',
        `<path d="${landD}" fill="#fbf7ef" fill-rule="evenodd"/>` +
        `<g clip-path="url(#${mask})" fill="#4a5784" opacity=".42">${dots}</g>` +
        `<path d="${polyD(s.v, parksOf(s))}" fill="#dcebd2" fill-opacity=".85" stroke="#dcebd2" stroke-width="4" stroke-linejoin="round" fill-rule="evenodd"/>` +
        toyRoads(s, '#fbf7ef', null, 0.8) + pinsSvg(s.v, s.pins, s.me),
        `<clipPath id="${mask}"><path d="${landD}" clip-rule="evenodd"/></clipPath>`);
    },
  },
  {
    id: 'G', title: 'G (지난번) — 조각을 끝점끼리만 이어 붙임',
    why: 'D+E에 땅·강·공원 윤곽도 길처럼 펴고 둥글게 굴림. 물가를 따라 옅은 얕은 물 띠를 둘러 보드게임 판의 바다처럼. 지류·작은 연못·작은 섬은 지움.',
    draw: (s) => svgWrap(TOY.water, toyGround(s) + toyRoads(s, TOY.road, TOY.casing) + neighbourhoodMarks(s) + pinsSvg(s.v, s.pins, s.me)),
  },
  {
    id: 'G2', title: 'G. 길을 제대로 이은 판',
    why: '위 G와 같은데 길을 다시 이음: 잘게 잘린 길 조각을 교차로마다 가장 곧게 이어지는 쪽끼리(같은 등급 우선) 한 줄기 길로 묶은 다음, 줄기 전체 길이로 고름. 그래서 그린 길은 끝에서 끝까지 이어지고, 중간에 끊기거나 혼자 떠 있는 토막이 없음. 나란한 왕복 차로도 지우지 않고 겹쳐 그림.',
    draw: (s) => svgWrap(TOY.water, toyGround(s) + joinedRoads(s, TOY.road, TOY.casing) + neighbourhoodMarks(s) + pinsSvg(s.v, s.pins, s.me)),
  },
  {
    id: 'H', title: 'H. G + 동 타일',
    why: 'G에 구역을 칠하지 않고 이음매만: 경계를 같은 방식으로 둥글게 펴서 땅보다 한 톤 짙은 선으로(축소하면 구, 그 밖엔 동). 보드게임 판의 칸처럼 "구역"은 보이되 색으로 떠들지 않음. 물 위에는 안 그림.',
    draw: (s) => {
      const clip = `tile${++maskCount}`;
      const k = SOFT[s.scale];
      return svgWrap(TOY.water, toyGround(s) + toyTiles(s, clip) + toyRoads(s, TOY.road, TOY.casing) + neighbourhoodMarks(s) + pinsSvg(s.v, s.pins, s.me),
        `<clipPath id="${clip}"><path d="${ringsD(softRings(s, s.land, k.tol, k.land))}" clip-rule="evenodd"/></clipPath>`);
    },
  },
];
/** This round's sheet: E as it was, then the two new ones. */
const SHOWN = ['G', 'G2'];

// ---- sheet ------------------------------------------------------------------

const PLACES: Record<string, { name: string; at: LonLat }> = {
  seongsu: { name: '성수', at: [127.056, 37.544] },
  river: { name: '한강', at: [127.04, 37.535] },
  jongno: { name: '종로', at: [126.99, 37.5705] },
  yangpyeong: { name: '양평', at: [127.4875, 37.4917] },
};
const SCALES: Record<Scale, { name: string; mpp: number }> = { gu: { name: '구', mpp: 40 }, dong: { name: '동', mpp: 12 }, block: { name: '골목', mpp: 1.5 } };

let html = `<!doctype html><meta charset="utf-8"><title>글자 없는 지도 시안</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Do+Hyeon&display=swap">
<style>body{margin:0;padding:24px;background:#ebe6dc;font-family:'Do Hyeon',sans-serif;color:#2a3354}
h1{font-size:28px;margin:0 0 6px}h2{font-size:22px;margin:28px 0 4px}p{margin:0 0 12px;max-width:900px;font-size:15px;line-height:1.5;font-family:system-ui,sans-serif}
.grid{display:grid;grid-template-columns:repeat(auto-fill,205px);gap:14px;justify-content:start}.cell{flex:none}.cell b{display:block;font-size:14px;margin:0 0 4px;font-weight:400;color:#6b6457}
svg{width:205px;height:auto;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.12);display:block}</style>
<h1>G — 길 잇기 전/후</h1><p>4곳 × 3축척, 실제 데이터, 글자 없음. 위는 지난번 G, 아래는 길을 줄기로 다시 이은 G. 핀·내 위치·앱 버튼 자리는 같게 그려 둠.</p>`;

const scenes = new Map<string, Scene>();
for (const [pk, place] of Object.entries(PLACES)) for (const [sk, scale] of Object.entries(SCALES) as [Scale, { mpp: number }][]) {
  const v = view(place.at[0], place.at[1], scale.mpp);
  const base = baseMap(v);
  const land = shapeBaseMap(base, v).land;
  const found = areas(v);
  scenes.set(`${pk}/${sk}`, { v, base, land, ...found, pins: PINS[pk] ?? [], me: place.at, scale: sk, spots: spots(v, found.sgg) });
}
for (const variant of VARIANTS.filter((v) => SHOWN.includes(v.id))) {
  html += `<h2>${variant.title}</h2><p>${variant.why}</p><div class="grid">`;
  for (const [pk, place] of Object.entries(PLACES))
    for (const [sk, scale] of Object.entries(SCALES)) html += `<div class="cell"><b>${place.name} · ${scale.name}</b>${variant.draw(scenes.get(`${pk}/${sk}`)!)}</div>`;
  html += '</div>';
}
writeFileSync('ui-shots/textless-variants.html', html);
console.log('ui-shots/textless-variants.html', Math.round(html.length / 1024), 'KB');
