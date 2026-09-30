/**
 * Picks the roads a course actually runs along, so the self-drawn map can show
 * just those — as whole streets, never chopped mid-block.
 *
 * Routing here is internal only: it decides which roads to draw. The course is
 * still shown as straight stop-to-stop lines with straight-line estimates, and
 * real directions still go to Kakao Map links (CLAUDE.md).
 *
 * Input is road geometry queried from vector tiles, which is messy as a graph:
 * roads are clipped per tile with a small overlap, so pieces of one street
 * don't share vertices. We re-node it (snap nearby vertices, join piece ends
 * onto the segment they overlap) before running Dijkstra.
 */
import { projection, type LngLat, type Projection, type Xy } from './localProjection';
import type { RoadCollection, RoadRank } from './roadFeatures';

/** Vertices this close are the same node. */
const SNAP_M = 2;
/** A piece's loose end this close to another road's segment is joined onto it (tile seams, T-junctions). */
const JOIN_M = 4;
/** A stop farther than this from every road is left out of routing. */
const STOP_REACH_M = 150;

export interface CourseRoads {
  roads: RoadCollection;
  /** Stop-to-stop legs that couldn't be routed (stop off-road, or roads not connected in the loaded tiles). */
  missedLegs: number;
}

export function roadsAlongCourse(input: RoadCollection, stops: LngLat[]): CourseRoads {
  const empty: RoadCollection = { type: 'FeatureCollection', features: [] };
  const legs = Math.max(0, stops.length - 1);
  if (legs === 0 || input.features.length === 0) return { roads: empty, missedLegs: legs };

  const proj = projection(stops[0][1]);
  const graph = buildGraph(input, proj);
  const selected = new Set<number>();
  let missedLegs = 0;
  for (let i = 0; i < legs; i++) {
    const path = routeLeg(graph, proj.toXy(stops[i]), proj.toXy(stops[i + 1]));
    if (path) path.forEach((e) => selected.add(e));
    else missedLegs++;
  }
  expandToJunctions(graph, selected);
  const lines = assembleLines(graph, selected);
  const features: RoadCollection['features'] = lines.map(({ pts, rank }) => ({
    type: 'Feature',
    properties: { kind: 'road', rank },
    geometry: { type: 'LineString', coordinates: pts.map(proj.toLngLat) },
  }));
  return { roads: { type: 'FeatureCollection', features }, missedLegs };
}

// --- geometry -------------------------------------------------------------


const dist = (a: Xy, b: Xy) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Distance from p to segment ab, and where along it (0…1) the closest point is. */
function toSegment(p: Xy, a: Xy, b: Xy): { d: number; t: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return { d: Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)), t };
}

/** Uniform-grid spatial index; items are registered in every cell their bbox touches. */
class Grid<T> {
  private cells = new Map<string, T[]>();
  constructor(private readonly size: number) {}
  private key(cx: number, cy: number) {
    return `${cx},${cy}`;
  }
  addBox(minX: number, minY: number, maxX: number, maxY: number, item: T) {
    for (let cx = Math.floor(minX / this.size); cx <= Math.floor(maxX / this.size); cx++) {
      for (let cy = Math.floor(minY / this.size); cy <= Math.floor(maxY / this.size); cy++) {
        const k = this.key(cx, cy);
        const cell = this.cells.get(k);
        if (cell) cell.push(item);
        else this.cells.set(k, [item]);
      }
    }
  }
  addSegment(a: Xy, b: Xy, item: T) {
    this.addBox(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), item);
  }
  near([x, y]: Xy, r: number): Set<T> {
    const out = new Set<T>();
    for (let cx = Math.floor((x - r) / this.size); cx <= Math.floor((x + r) / this.size); cx++) {
      for (let cy = Math.floor((y - r) / this.size); cy <= Math.floor((y + r) / this.size); cy++) {
        this.cells.get(this.key(cx, cy))?.forEach((item) => out.add(item));
      }
    }
    return out;
  }
}

// --- graph ----------------------------------------------------------------

interface Edge {
  a: number;
  b: number;
  len: number;
  rank: RoadRank;
}

interface Graph {
  nodes: Xy[];
  edges: Edge[];
  /** Edge ids per node. */
  adj: number[][];
}

function buildGraph(input: RoadCollection, proj: Projection): Graph {
  const polys: { pts: Xy[]; rank: RoadRank }[] = [];
  for (const f of input.features) {
    if (f.properties.kind !== 'road') continue;
    const parts = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const part of parts) if (part.length >= 2) polys.push({ pts: part.map((c) => proj.toXy(c as LngLat)), rank: f.properties.rank });
  }

  // Join loose ends onto the segment they touch: insert the end point itself
  // into that segment, so vertex snapping below connects them exactly.
  const segs = new Grid<[number, number]>(JOIN_M * 4);
  polys.forEach(({ pts }, i) => pts.slice(1).forEach((b, j) => segs.addSegment(pts[j], b, [i, j])));
  const inserts = new Map<string, { t: number; p: Xy }[]>();
  polys.forEach(({ pts }, i) => {
    for (const p of [pts[0], pts[pts.length - 1]]) {
      for (const [k, j] of segs.near(p, JOIN_M)) {
        if (k === i) continue;
        const { d, t } = toSegment(p, polys[k].pts[j], polys[k].pts[j + 1]);
        if (d > JOIN_M || t <= 0 || t >= 1) continue;
        const key = `${k}:${j}`;
        const list = inserts.get(key);
        if (list) list.push({ t, p });
        else inserts.set(key, [{ t, p }]);
      }
    }
  });
  const noded = polys.map(({ pts, rank }, i) => {
    const out: Xy[] = [pts[0]];
    for (let j = 0; j < pts.length - 1; j++) {
      (inserts.get(`${i}:${j}`) ?? []).sort((x, y) => x.t - y.t).forEach(({ p }) => out.push(p));
      out.push(pts[j + 1]);
    }
    return { pts: out, rank };
  });

  const nodes: Xy[] = [];
  const adj: number[][] = [];
  const nodeGrid = new Grid<number>(SNAP_M * 4);
  const nodeAt = (p: Xy) => {
    for (const n of nodeGrid.near(p, SNAP_M)) if (dist(nodes[n], p) <= SNAP_M) return n;
    nodes.push(p);
    adj.push([]);
    nodeGrid.addBox(p[0], p[1], p[0], p[1], nodes.length - 1);
    return nodes.length - 1;
  };
  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const { pts, rank } of noded) {
    let prev = nodeAt(pts[0]);
    for (let j = 1; j < pts.length; j++) {
      const n = nodeAt(pts[j]);
      // Overlapping tile pieces yield the same edge twice; keep one.
      const key = prev < n ? `${prev}-${n}` : `${n}-${prev}`;
      if (n !== prev && !seen.has(key)) {
        seen.add(key);
        edges.push({ a: prev, b: n, len: dist(nodes[prev], nodes[n]), rank });
        adj[prev].push(edges.length - 1);
        adj[n].push(edges.length - 1);
      }
      prev = n;
    }
  }
  return { nodes, edges, adj };
}

const other = (e: Edge, n: number) => (e.a === n ? e.b : e.a);

function nearestEdge(g: Graph, p: Xy): { edge: number; t: number; d: number } | null {
  let best: { edge: number; t: number; d: number } | null = null;
  g.edges.forEach((e, i) => {
    const { d, t } = toSegment(p, g.nodes[e.a], g.nodes[e.b]);
    if (d <= STOP_REACH_M && (!best || d < best.d)) best = { edge: i, t, d };
  });
  return best;
}

/** Edge ids from the road nearest `from` to the road nearest `to`, or null. */
function routeLeg(g: Graph, from: Xy, to: Xy): number[] | null {
  const s = nearestEdge(g, from);
  const t = nearestEdge(g, to);
  if (!s || !t) return null;
  if (s.edge === t.edge) return [s.edge];
  const se = g.edges[s.edge];
  const te = g.edges[t.edge];
  // Enter the graph at either end of the start edge, leave at either end of
  // the end edge, each end costing the distance along the edge to reach it.
  const sources: [number, number][] = [[se.a, s.t * se.len], [se.b, (1 - s.t) * se.len]];
  const targets = new Map<number, number>([[te.a, t.t * te.len], [te.b, (1 - t.t) * te.len]]);

  const n = g.nodes.length;
  const best = new Float64Array(n).fill(Infinity);
  const via = new Int32Array(n).fill(-1);
  const heap = new MinHeap();
  for (const [node, cost] of sources) {
    if (cost < best[node]) {
      best[node] = cost;
      heap.push(cost, node);
    }
  }
  let bestTotal = Infinity;
  let bestTarget = -1;
  while (heap.size > 0) {
    const [d, node] = heap.pop();
    if (d > best[node]) continue;
    if (d >= bestTotal) break;
    const exit = targets.get(node);
    if (exit !== undefined && d + exit < bestTotal) {
      bestTotal = d + exit;
      bestTarget = node;
    }
    for (const ei of g.adj[node]) {
      const next = other(g.edges[ei], node);
      const nd = d + g.edges[ei].len;
      if (nd < best[next]) {
        best[next] = nd;
        via[next] = ei;
        heap.push(nd, next);
      }
    }
  }
  if (bestTarget < 0) return null;
  const path = [s.edge, t.edge];
  for (let node = bestTarget; via[node] >= 0; node = other(g.edges[via[node]], node)) path.push(via[node]);
  return path;
}

/**
 * Grows each selected edge out to the nearest junction or dead end on both
 * sides, so a street is drawn from corner to corner rather than stopping
 * where a stop happens to sit or where a tile edge cut it.
 */
function expandToJunctions(g: Graph, selected: Set<number>) {
  const queue = [...selected];
  while (queue.length > 0) {
    const e = g.edges[queue.pop()!];
    for (const node of [e.a, e.b]) {
      if (g.adj[node].length !== 2) continue;
      for (const next of g.adj[node]) {
        if (!selected.has(next)) {
          selected.add(next);
          queue.push(next);
        }
      }
    }
  }
}

/** Joins selected edges into polylines, breaking at junctions so each line is one street stretch. */
function assembleLines(g: Graph, selected: Set<number>): { pts: Xy[]; rank: RoadRank }[] {
  const selDeg = new Map<number, number>();
  for (const ei of selected) for (const n of [g.edges[ei].a, g.edges[ei].b]) selDeg.set(n, (selDeg.get(n) ?? 0) + 1);
  const isEnd = (n: number) => selDeg.get(n) !== 2 || g.adj[n].length !== 2;
  const used = new Set<number>();
  const lines: { pts: Xy[]; rank: RoadRank }[] = [];
  const walk = (start: number, firstEdge: number) => {
    const pts: Xy[] = [g.nodes[start]];
    let node = start;
    let ei = firstEdge;
    for (;;) {
      used.add(ei);
      node = other(g.edges[ei], node);
      pts.push(g.nodes[node]);
      if (isEnd(node)) break;
      const next = g.adj[node].find((x) => selected.has(x) && !used.has(x));
      if (next === undefined) break;
      ei = next;
    }
    lines.push({ pts, rank: g.edges[firstEdge].rank });
  };
  for (const ei of selected) {
    if (used.has(ei)) continue;
    const e = g.edges[ei];
    if (isEnd(e.a)) walk(e.a, ei);
    else if (isEnd(e.b)) walk(e.b, ei);
  }
  // Whatever is left forms closed loops with no junction on them.
  for (const ei of selected) if (!used.has(ei)) walk(g.edges[ei].a, ei);
  return lines;
}

// --- heap -----------------------------------------------------------------

class MinHeap {
  private items: [number, number][] = [];
  get size() {
    return this.items.length;
  }
  push(key: number, value: number) {
    const a = this.items;
    a.push([key, value]);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}
