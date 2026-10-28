import type { RoadTier } from './baseMap';

/** A point in screen pixels. */
export type StrokePoint = [number, number];

export interface RoadPiece {
  tier: RoadTier;
  path: StrokePoint[];
}

/** One road as a person reads it: pieces joined end to end through every junction it runs straight on. */
export interface RoadStroke {
  /** The tier most of its length has. */
  tier: RoadTier;
  path: StrokePoint[];
  length: number;
}

/**
 * Ends closer than this (px) are the same junction. The data's pieces meet
 * exactly or within a pixel (cut at tile edges, rounded to 5 decimals).
 */
export const JOIN_PX = 1;
/** How far a road may bend at a junction (degrees) and still run on as the same road. */
export const MAX_TURN_DEG = 50;
/** A road that goes on as a lower or higher tier counts as bending this much more per tier step, so an avenue prefers to continue as the avenue. */
const TIER_TURN_DEG = 15;
/** How far along a piece its direction at a junction is measured (px): the first vertex can sit right on top of the junction. */
const AIM_PX = 6;

const lengthOf = (path: StrokePoint[]) => path.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - path[i][0], y - path[i][1]), 0);

/**
 * The road pieces (cut by tile and by source way, so an avenue is dozens of
 * stubs) joined into strokes: at each junction, the two pieces that run on
 * most nearly straight — the same tier preferred — are paired, and pieces
 * are followed through their pairs. A street ending on the side of an avenue
 * (a T) splits the avenue there, so both are seen to meet. This is the
 * "natural road" reading of a street network: filtering and drawing whole
 * strokes keeps roads continuous, where filtering pieces left gaps and stubs.
 */
export function joinRoads(pieces: RoadPiece[], joinPx = JOIN_PX): RoadStroke[] {
  const key = ([x, y]: StrokePoint) => `${Math.round(x / joinPx)},${Math.round(y / joinPx)}`;
  // Junction keys: every piece end, so a piece passing through one is split there.
  const ends = new Set<string>();
  for (const p of pieces) if (p.path.length >= 2) { ends.add(key(p.path[0])); ends.add(key(p.path[p.path.length - 1])); }
  const edges: RoadPiece[] = [];
  for (const p of pieces) {
    if (p.path.length < 2) continue;
    let start = 0;
    for (let i = 1; i < p.path.length - 1; i++) {
      if (ends.has(key(p.path[i]))) { edges.push({ tier: p.tier, path: p.path.slice(start, i + 1) }); start = i; }
    }
    edges.push({ tier: p.tier, path: p.path.slice(start) });
  }

  // Each edge has two ends (0 = its first point, 1 = its last); a junction lists the ends that meet there.
  const junctions = new Map<string, number[]>();
  edges.forEach((e, i) => {
    for (const side of [0, 1]) {
      const k = key(side ? e.path[e.path.length - 1] : e.path[0]);
      const list = junctions.get(k);
      if (list) list.push(i * 2 + side); else junctions.set(k, [i * 2 + side]);
    }
  });
  /** The direction an edge leaves a junction in, from the end `end` (= edge * 2 + side). */
  const aim = (end: number): StrokePoint => {
    const path = edges[end >> 1].path;
    const points = end & 1 ? [...path].reverse() : path;
    const [x0, y0] = points[0];
    // The point AIM_PX along the line (not the first vertex past it: a long first span would swing the aim to its far end).
    let target = points[points.length - 1];
    for (let i = 1, walked = 0; i < points.length; i++) {
      const [ax, ay] = points[i - 1], [bx, by] = points[i];
      const span = Math.hypot(bx - ax, by - ay);
      if (walked + span >= AIM_PX) {
        const t = (AIM_PX - walked) / span;
        target = [ax + (bx - ax) * t, ay + (by - ay) * t];
        break;
      }
      walked += span;
    }
    const len = Math.hypot(target[0] - x0, target[1] - y0) || 1;
    return [(target[0] - x0) / len, (target[1] - y0) / len];
  };
  const partner = new Int32Array(edges.length * 2).fill(-1);
  for (const list of junctions.values()) {
    if (list.length < 2) continue;
    const pairs: { a: number; b: number; turn: number }[] = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const [a, b] = [list[i], list[j]];
      if (a >> 1 === b >> 1) continue; // a loop's two ends
      const [ax, ay] = aim(a), [bx, by] = aim(b);
      // Running straight on means leaving in opposite directions.
      const turn = (Math.acos(Math.max(-1, Math.min(1, -(ax * bx + ay * by)))) * 180) / Math.PI +
        TIER_TURN_DEG * Math.abs(edges[a >> 1].tier - edges[b >> 1].tier);
      if (turn <= MAX_TURN_DEG) pairs.push({ a, b, turn });
    }
    pairs.sort((p, q) => p.turn - q.turn);
    for (const { a, b } of pairs) if (partner[a] < 0 && partner[b] < 0) { partner[a] = b; partner[b] = a; }
  }

  const used = new Uint8Array(edges.length);
  const strokes: RoadStroke[] = [];
  /** Follows edges from `end` onward (entering each at its partner end), adding their points. */
  const walk = (from: number, out: StrokePoint[], tierLength: number[]) => {
    let end = from;
    while (end >= 0 && !used[end >> 1]) {
      const edge = end >> 1;
      used[edge] = 1;
      const points = end & 1 ? [...edges[edge].path].reverse() : edges[edge].path;
      out.push(...points.slice(1));
      tierLength[edges[edge].tier] += lengthOf(points);
      end = partner[(end ^ 1)];
    }
  };
  const build = (edge: number) => {
    // Back up to the stroke's start (an end with no partner), or around a loop to here.
    let end = edge * 2;
    for (let steps = 0; partner[end] >= 0 && steps <= edges.length; steps++) {
      const prev = partner[end];
      if (prev >> 1 === edge) break;
      end = prev ^ 1;
    }
    const first = end & 1 ? edges[end >> 1].path[edges[end >> 1].path.length - 1] : edges[end >> 1].path[0];
    const path: StrokePoint[] = [first];
    const tierLength = [0, 0, 0, 0, 0, 0];
    walk(end, path, tierLength);
    const tier = tierLength.indexOf(Math.max(...tierLength)) as RoadTier;
    strokes.push({ tier, path, length: lengthOf(path) });
  };
  for (let i = 0; i < edges.length; i++) if (!used[i]) build(i);
  return strokes;
}
