import type { MapPoint } from './miniMap';

/**
 * 미니맵's outline (docs/plan-minimap-silhouette.md). The 읍면동 around the
 * stops make a lump whose edge was drawn for offices, not for eyes: thin arms,
 * narrow bites, steps along every block. The outline is only the frame the
 * real map is cut with (what is inside stays the base map), so it may be
 * designed as a silhouette:
 * - it has to read as one mass when filled in one colour (Thomas & Johnston's
 *   silhouette test): arms and necks thinner than `NECK` are cut away, bites
 *   narrower than `NOTCH` are filled (opening and closing on a grid);
 * - but it is still a piece of a map: only the arms and the bites go. A plain
 *   opening or closing would round every corner as well, and the lump looked
 *   like melted ice cream; so the corners are given back, and the edge is
 *   straightened (Douglas–Peucker) rather than smoothed: borders along rivers
 *   and big roads stay straight, corners stay corners, only eased a little
 *   (Stanchfield's straights against curves).
 * Every stop keeps land around it (`STOP_ROOM`), whatever is cut.
 *
 * Units: the flat (untilted) layout of the day's picture, where 1 is the
 * picture's width; a pin is about 0.1 across.
 */

/** Grid cell (flat units): under 3 px of the day screen's 330 px picture (the traced edge lies between cells, so it is finer than that). */
const CELL = 0.008;
/** Bites and gaps narrower than twice this are filled. */
export const NOTCH_R = 0.04;
/** Arms and necks narrower than twice this are cut away. */
export const NECK_R = 0.032;
/** Land kept round every stop (flat units, about 20 px). */
export const STOP_ROOM = 0.06;
/**
 * The traced edge is straightened to within this (Douglas–Peucker, flat
 * units, about 2 px): the grid's own jitter and the smallest steps go, the
 * real corners stay corners and long borders (rivers, big roads) stay straight.
 */
const EDGE_TOL = 0.006;
/** Outer corners nearer than this share of the neck radius to the opened body are given back (a right angle lies at 0.41). */
const RESTORE = 0.6;
/** Of what a closing adds, only parts thicker than this share of its radius are bites (a filled inner corner is thinner). */
const BITE_CORE = 0.45;
/** A corner is only eased, along this much of each of its edges at most: crisp, not melted. */
const CORNER = 0.01;
/** The aim: the outline fills this much of its convex hull (Arnheim's simple form). */
export const SOLIDITY_AIM = 0.85;

interface Grid {
  w: number;
  h: number;
  x0: number;
  y0: number;
}

const BIG = 1e20;

/** Squared distance transform along one line (Felzenszwalb & Huttenlocher). */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    const fq = f[q] + q * q;
    let r = v[k];
    let s = (fq - (f[r] + r * r)) / (2 * (q - r));
    while (s <= z[k]) {
      k--;
      r = v[k];
      s = (fq - (f[r] + r * r)) / (2 * (q - r));
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) ** 2 + f[v[k]];
  }
}

/** Squared distance (in cells) from every cell to the nearest cell of `mask`. */
export function distanceTo(mask: Uint8Array, w: number, h: number): Float64Array {
  const n = Math.max(w, h);
  const [f, d, z, v] = [new Float64Array(n), new Float64Array(n), new Float64Array(n + 1), new Int32Array(n)];
  const out = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = mask[i] ? 0 : BIG;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = out[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = out[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = d[x];
  }
  return out;
}

const invert = (mask: Uint8Array) => mask.map((m) => (m ? 0 : 1));
const where = (d: Float64Array, keep: (d: number) => boolean) => Uint8Array.from(d, (x) => (keep(x) ? 1 : 0));
/** Every cell within `r` cells of the mask. */
const dilate = (mask: Uint8Array, w: number, h: number, r: number) => where(distanceTo(mask, w, h), (d) => d <= r * r);
/** Every cell of the mask more than `r` cells from its outside. */
const erode = (mask: Uint8Array, w: number, h: number, r: number) => where(distanceTo(invert(mask), w, h), (d) => d > r * r);
/** Fills bites and gaps narrower than 2·`r` cells. */
export const closing = (mask: Uint8Array, w: number, h: number, r: number) => erode(dilate(mask, w, h, r), w, h, r);
/** Cuts away arms and necks thinner than 2·`r` cells. */
export const opening = (mask: Uint8Array, w: number, h: number, r: number) => dilate(erode(mask, w, h, r), w, h, r);

/** Polygons (each a list of rings, filled even-odd) painted on the grid, cell middles inside. */
function rasterize(polygons: MapPoint[][][], g: Grid): Uint8Array {
  const mask = new Uint8Array(g.w * g.h);
  const rows: number[][] = Array.from({ length: g.h }, () => []);
  for (const rings of polygons) {
    let [lo, hi] = [g.h, -1];
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const [a, b] = [ring[i], ring[(i + 1) % ring.length]];
        // Rows whose middle line the edge crosses (half-open, so a shared vertex counts once).
        const [ya, yb] = [(a.y - g.y0) / CELL - 0.5, (b.y - g.y0) / CELL - 0.5];
        if (ya === yb) continue;
        const [from, to] = ya < yb ? [Math.ceil(ya), Math.ceil(yb) - 1] : [Math.ceil(yb), Math.ceil(ya) - 1];
        for (let y = Math.max(0, from); y <= Math.min(g.h - 1, to); y++) {
          const t = (y - ya) / (yb - ya);
          rows[y].push((a.x + (b.x - a.x) * t - g.x0) / CELL - 0.5);
          lo = Math.min(lo, y);
          hi = Math.max(hi, y);
        }
      }
    }
    for (let y = lo; y <= hi; y++) {
      const xs = rows[y].sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(g.w - 1, Math.floor(xs[k + 1])); x++) mask[y * g.w + x] = 1;
      }
      rows[y] = [];
    }
  }
  return mask;
}

/** Discs of `r` (flat units) round the points, painted on the mask. */
function paintDiscs(mask: Uint8Array, g: Grid, points: MapPoint[], r: number) {
  const rc = r / CELL;
  for (const p of points) {
    const [cx, cy] = [(p.x - g.x0) / CELL - 0.5, (p.y - g.y0) / CELL - 0.5];
    for (let y = Math.max(0, Math.floor(cy - rc)); y <= Math.min(g.h - 1, Math.ceil(cy + rc)); y++) {
      for (let x = Math.max(0, Math.floor(cx - rc)); x <= Math.min(g.w - 1, Math.ceil(cx + rc)); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= rc * rc) mask[y * g.w + x] = 1;
      }
    }
  }
}

/** Connected pieces (4-neighbours) of cells equal to `value`: a label per cell (-1 for others) and each piece's size. */
function pieces(mask: Uint8Array, w: number, h: number, value: number) {
  const label = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (mask[s] !== value || label[s] >= 0) continue;
    const id = sizes.length;
    let size = 0;
    label[s] = id;
    stack.push(s);
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const x = c % w;
      const visit = (nc: number) => {
        if (mask[nc] === value && label[nc] < 0) {
          label[nc] = id;
          stack.push(nc);
        }
      };
      if (x > 0) visit(c - 1);
      if (x < w - 1) visit(c + 1);
      if (c >= w) visit(c - w);
      if (c < w * (h - 1)) visit(c + w);
    }
    sizes.push(size);
  }
  return { label, sizes };
}

/**
 * Only the pieces with a stop on them (a piece cut off by an opening, or land
 * the bending carried away from every stop, is frame with no story); and no
 * holes.
 */
function tidy(mask: Uint8Array, g: Grid, stops: MapPoint[]): Uint8Array {
  const { label, sizes } = pieces(mask, g.w, g.h, 1);
  const cellOf = (p: MapPoint) => {
    const [x, y] = [Math.floor((p.x - g.x0) / CELL), Math.floor((p.y - g.y0) / CELL)];
    return x >= 0 && y >= 0 && x < g.w && y < g.h ? y * g.w + x : -1;
  };
  const held = new Set(stops.map(cellOf).filter((c) => c >= 0).map((c) => label[c]).filter((l) => l >= 0));
  const keep = sizes.map((_, id) => held.has(id));
  const out = mask.map((m, i) => (m && keep[label[i]] ? 1 : 0));
  // Holes: water pieces that do not reach the grid's edge are filled.
  const water = pieces(out, g.w, g.h, 0);
  const open = new Set<number>();
  for (let x = 0; x < g.w; x++) open.add(water.label[x]).add(water.label[(g.h - 1) * g.w + x]);
  for (let y = 0; y < g.h; y++) open.add(water.label[y * g.w]).add(water.label[y * g.w + g.w - 1]);
  return out.map((m, i) => (m || !open.has(water.label[i]) ? 1 : 0));
}

/**
 * The outlines of the mask (marching squares) on a smooth field: the signed
 * distance to the mask's edge, so a diagonal edge comes out as a line rather
 * than steps. Saddles are settled by the cell's middle.
 */
function outlines(mask: Uint8Array, g: Grid): MapPoint[][] {
  const { w, h } = g;
  const inside = distanceTo(invert(mask), w, h);
  const outside = distanceTo(mask, w, h);
  const v = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) v[i] = mask[i] ? Math.sqrt(inside[i]) - 0.5 : 0.5 - Math.sqrt(outside[i]);
  const val = (i: number, j: number) => v[j * w + i];
  const at = (i: number, j: number): MapPoint => ({ x: g.x0 + (i + 0.5) * CELL, y: g.y0 + (j + 0.5) * CELL });
  // Grid edges as numbers: horizontal (i, j)→(i+1, j) is 2k, vertical (i, j)→(i, j+1) is 2k+1, k = j·w + i.
  const cross = (e: number): MapPoint => {
    const k = e >> 1;
    const [i, j] = [k % w, Math.floor(k / w)];
    const [i2, j2] = e & 1 ? [i, j + 1] : [i + 1, j];
    const [p, q] = [at(i, j), at(i2, j2)];
    const [a, b] = [val(i, j), val(i2, j2)];
    const t = a === b ? 0.5 : a / (a - b);
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
  };
  const links = new Map<number, number[]>();
  const join = (e: number, f: number) => {
    links.set(e, [...(links.get(e) ?? []), f]);
    links.set(f, [...(links.get(f) ?? []), e]);
  };
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const [a, b, c, d] = [val(i, j), val(i + 1, j), val(i + 1, j + 1), val(i, j + 1)];
      const code = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const k = j * w + i;
      const [top, right, bottom, left] = [2 * k, 2 * (k + 1) + 1, 2 * (k + w), 2 * k + 1];
      const middle = a + b + c + d > 0;
      const pairs: Record<number, [number, number][]> = {
        1: [[left, bottom]],
        2: [[bottom, right]],
        3: [[left, right]],
        4: [[top, right]],
        5: middle ? [[left, top], [bottom, right]] : [[left, bottom], [top, right]],
        6: [[top, bottom]],
        7: [[left, top]],
        8: [[left, top]],
        9: [[top, bottom]],
        10: middle ? [[left, bottom], [top, right]] : [[left, top], [bottom, right]],
        11: [[top, right]],
        12: [[left, right]],
        13: [[bottom, right]],
        14: [[left, bottom]],
      };
      for (const [e, f] of pairs[code]) join(e, f);
    }
  }
  const rings: MapPoint[][] = [];
  const used = new Set<number>();
  for (const start of links.keys()) {
    if (used.has(start)) continue;
    const ring: MapPoint[] = [];
    let [prev, cur] = [-1, start];
    while (cur >= 0 && !used.has(cur)) {
      used.add(cur);
      ring.push(cross(cur));
      const next = (links.get(cur) ?? []).find((e) => e !== prev && !used.has(e));
      [prev, cur] = [cur, next ?? -1];
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

const segDist = (p: MapPoint, a: MapPoint, b: MapPoint): number => {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

/** Douglas–Peucker on a closed ring: split at the point farthest from the first, then each half. Corners stay sharp. */
export function simplifyRing(ring: MapPoint[], tol: number): MapPoint[] {
  const n = ring.length;
  if (n <= 4) return ring;
  let far = 0;
  for (let i = 1; i < n; i++) if (Math.hypot(ring[i].x - ring[0].x, ring[i].y - ring[0].y) > Math.hypot(ring[far].x - ring[0].x, ring[far].y - ring[0].y)) far = i;
  const keep = new Uint8Array(n);
  keep[0] = keep[far] = 1;
  const stack: [number, number][] = [[0, far], [far, n]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const end = ring[b % n];
    let [worst, at] = [0, -1];
    for (let i = a + 1; i < b; i++) {
      const d = segDist(ring[i], ring[a], end);
      if (d > worst) [worst, at] = [d, i];
    }
    if (at > 0 && worst > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

const triArea = (a: MapPoint, b: MapPoint, c: MapPoint) => Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;

/** Visvalingam–Whyatt on a closed ring: drops the point making the least area until none makes less than `minArea`. */
export function visvalingam(ring: MapPoint[], minArea: number, minPoints = 6): MapPoint[] {
  const n = ring.length;
  if (n <= minPoints) return ring;
  const prev = Int32Array.from({ length: n }, (_, i) => (i + n - 1) % n);
  const next = Int32Array.from({ length: n }, (_, i) => (i + 1) % n);
  const alive = new Uint8Array(n).fill(1);
  const area = Float64Array.from({ length: n }, (_, i) => triArea(ring[prev[i]], ring[i], ring[next[i]]));
  let left = n;
  while (left > minPoints) {
    let [low, at] = [Infinity, -1];
    for (let i = 0; i < n; i++) if (alive[i] && area[i] < low) [low, at] = [area[i], i];
    if (low >= minArea) break;
    alive[at] = 0;
    left--;
    const [p, q] = [prev[at], next[at]];
    next[p] = q;
    prev[q] = p;
    // A neighbour's area never drops below the one just taken (so the smallest goes first, in order).
    area[p] = Math.max(low, triArea(ring[prev[p]], ring[p], ring[next[p]]));
    area[q] = Math.max(low, triArea(ring[prev[q]], ring[q], ring[next[q]]));
  }
  return ring.filter((_, i) => alive[i]);
}

/**
 * Every corner rounded off along at most `CORNER` and at most half of each of
 * its edges (a quadratic curve with the corner as its control): a long edge
 * keeps a straight middle, and a run of short edges, where the curves meet
 * halfway, becomes one smooth curve. Nearly straight corners stay as they are.
 */
export function roundCorners(ring: MapPoint[], reach = CORNER, steps = 5): MapPoint[] {
  const n = ring.length;
  if (n < 3) return ring;
  const out: MapPoint[] = [];
  for (let i = 0; i < n; i++) {
    const [a, v, b] = [ring[(i + n - 1) % n], ring[i], ring[(i + 1) % n]];
    const [la, lb] = [Math.hypot(a.x - v.x, a.y - v.y), Math.hypot(b.x - v.x, b.y - v.y)];
    if (!la || !lb) continue;
    const turn = Math.abs(Math.atan2((v.x - a.x) * (b.y - v.y) - (v.y - a.y) * (b.x - v.x), (v.x - a.x) * (b.x - v.x) + (v.y - a.y) * (b.y - v.y)));
    if (turn < 0.1) {
      out.push(v);
      continue;
    }
    const [da, db] = [Math.min(reach, la / 2), Math.min(reach, lb / 2)];
    const s = { x: v.x + ((a.x - v.x) / la) * da, y: v.y + ((a.y - v.y) / la) * da };
    const e = { x: v.x + ((b.x - v.x) / lb) * db, y: v.y + ((b.y - v.y) / lb) * db };
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const [p, q, r] = [(1 - t) ** 2, 2 * (1 - t) * t, t * t];
      out.push({ x: p * s.x + q * v.x + r * e.x, y: p * s.y + q * v.y + r * e.y });
    }
  }
  return out;
}

export const ringArea = (ring: MapPoint[]) => Math.abs(ring.reduce((s, p, i) => {
  const q = ring[(i + 1) % ring.length];
  return s + p.x * q.y - q.x * p.y;
}, 0)) / 2;

function hull(points: MapPoint[]): MapPoint[] {
  const pts = [...points].sort((p, q) => p.x - q.x || p.y - q.y);
  if (pts.length < 3) return pts;
  const cross = (o: MapPoint, a: MapPoint, b: MapPoint) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: MapPoint[]) => {
    const out: MapPoint[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/** Area over the area of each piece's convex hull, weighted by area (1 = no dents). */
function solidity(rings: MapPoint[][]): number {
  const areas = rings.map(ringArea);
  const total = areas.reduce((s, a) => s + a, 0) || 1;
  return rings.reduce((s, ring, i) => s + areas[i] * (areas[i] / (ringArea(hull(ring)) || 1)), 0) / total;
}

/** How good an outline is as a silhouette (plan §4 S0). */
export interface SilhouetteStats {
  /** Pieces of land. */
  pieces: number;
  /** Area over the area of each piece's convex hull, weighted by area (1 = no dents). */
  solidity: number;
  /** The biggest piece's share of all the land. */
  main: number;
  /** Sharp turns (over 30°) per unit of outline: steps and teeth. */
  wiggle: number;
  /** Share of the land in arms and necks thinner than 2·`NECK_R` (what an opening cuts). */
  thin: number;
  /** Area of the bites narrower than 2·`NOTCH_R` (what a closing fills), against the land. */
  bites: number;
}

/** Measures outlines (flat units, filled even-odd). */
export function silhouetteStats(rings: MapPoint[][]): SilhouetteStats {
  const areas = rings.map(ringArea);
  const total = areas.reduce((s, a) => s + a, 0) || 1;
  let [turns, length] = [0, 0];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [a, v, b] = [ring[(i + ring.length - 1) % ring.length], ring[i], ring[(i + 1) % ring.length]];
      length += Math.hypot(b.x - v.x, b.y - v.y);
      const turn = Math.abs(Math.atan2((v.x - a.x) * (b.y - v.y) - (v.y - a.y) * (b.x - v.x), (v.x - a.x) * (b.x - v.x) + (v.y - a.y) * (b.y - v.y)));
      if (turn > Math.PI / 6) turns++;
    }
  }
  const g = gridAround(rings.flat(), NOTCH_R * 2);
  const mask = rasterize([rings], g);
  const count = (m: Uint8Array) => m.reduce((s, x) => s + x, 0);
  const land = count(mask) || 1;
  const thin = (land - count(opening(mask, g.w, g.h, NECK_R / CELL))) / land;
  const bites = (count(closing(mask, g.w, g.h, NOTCH_R / CELL)) - land) / land;
  return { pieces: rings.length, solidity: solidity(rings), main: Math.max(0, ...areas) / total, wiggle: length ? turns / length : 0, thin, bites };
}

function gridAround(points: MapPoint[], pad: number): Grid {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, y0] = [Math.min(...xs) - pad, Math.min(...ys) - pad];
  return { x0, y0, w: Math.ceil((Math.max(...xs) + pad - x0) / CELL) + 1, h: Math.ceil((Math.max(...ys) + pad - y0) / CELL) + 1 };
}

/**
 * The outline for land made of `polygons` (each a list of rings, even-odd;
 * flat units) with `stops` on it: closed, opened, tidied, traced, its wiggles
 * dropped and its corners rounded. A lump that stays too dented is closed
 * harder, up to twice. Empty when there is no land.
 */
export function silhouette(polygons: MapPoint[][][], stops: MapPoint[]): MapPoint[][] {
  const points = polygons.flat(2);
  if (!points.length) return [];
  let best: { rings: MapPoint[][]; solidity: number } | null = null;
  for (const k of [1, 1.6, 2.4]) {
    const notch = NOTCH_R * k;
    const g = gridAround([...points, ...stops], notch + STOP_ROOM + CELL * 3);
    const { w, h } = g;
    const room = (mask: Uint8Array) => {
      paintDiscs(mask, g, stops, STOP_ROOM);
      return mask;
    };
    const land = room(rasterize(polygons, g));
    // An opening alone would round every outer corner (melted ice cream): only
    // what lies far from the opened body is cut, so the arms go and the
    // corners, which lie close to it, come back as they are.
    const body = dilate(opening(land, w, h, NECK_R / CELL), w, h, (NECK_R / CELL) * RESTORE);
    let mask = room(land.map((m, i) => m & body[i]));
    // A closing alone would fill every inner corner too: only the thick part
    // of what it adds is kept, the bites; a corner's sliver is thin.
    const added = closing(mask, w, h, notch / CELL).map((m, i) => (m && !mask[i] ? 1 : 0));
    const bites = opening(added, w, h, (notch / CELL) * BITE_CORE);
    mask = tidy(mask.map((m, i) => m | bites[i]), g, stops);
    const rings = outlines(mask, g)
      .map((ring) => roundCorners(simplifyRing(ring, EDGE_TOL), CORNER))
      .filter((ring) => ring.length >= 3);
    const solid = solidity(rings);
    if (!best || solid > best.solidity) best = { rings, solidity: solid };
    if (solid >= SOLIDITY_AIM) break;
  }
  return best!.rings;
}

/** The outline of the land as it is (painted and traced on the same grid, nothing cut, filled or rounded): what `silhouetteStats` measures a lump's own outline by. */
export function rawOutline(polygons: MapPoint[][][]): MapPoint[][] {
  const points = polygons.flat(2);
  if (!points.length) return [];
  const g = gridAround(points, CELL * 3);
  return outlines(rasterize(polygons, g), g);
}
