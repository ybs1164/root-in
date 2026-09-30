/**
 * Rounded block corners where roads meet — the flat illustrated-map look,
 * where a junction flares out instead of two strokes simply crossing.
 *
 * Road strokes alone leave a sharp inside corner between every pair of
 * roads. For each such corner we build the patch between that corner and a
 * circular arc tangent to both road edges, and fill it in the road color.
 * Everything is in ground meters, so roads must be drawn at a fixed ground
 * width (not a fixed pixel width) for the patches to line up at every zoom.
 */
import { projection, type Xy } from './localProjection';
import type { RoadCollection } from './roadFeatures';

export type FilletCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon>;

/** Wedges wider than this are treated as a straight road: nothing to round. */
const MAX_WEDGE = (170 * Math.PI) / 180;
const ARC_STEPS = 10;

interface Arm {
  /** Unit direction leaving the node. */
  dir: Xy;
  angle: number;
  /** How far along the road we may place a tangent point. */
  reach: number;
}

/**
 * Fillets at every point where two or more road lines end together (the
 * road-route output breaks lines exactly at junctions). Bends inside a line
 * are left to the stroke's round join.
 */
export function junctionFillets(roads: RoadCollection, halfWidth: number, radius: number): FilletCollection {
  const first = roads.features[0]?.geometry;
  if (!first) return { type: 'FeatureCollection', features: [] };
  const originLat = (first.type === 'LineString' ? first.coordinates[0] : first.coordinates[0][0])[1];
  const proj = projection(originLat);

  const nodes = new Map<string, { at: Xy; arms: Arm[] }>();
  // A fillet may reach at most this far along each road. Arms are treated as
  // straight within it, so a long fillet on a curving road would stick out
  // past the road's real edge; acute corners get a smaller radius instead.
  const maxAlong = halfWidth + radius;
  const addArm = (line: Xy[]) => {
    const at = line[0];
    let travelled = 0;
    let target = line[1];
    for (let i = 1; i < line.length; i++) {
      const seg = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
      if (travelled + seg >= maxAlong) {
        const t = (maxAlong - travelled) / seg;
        target = [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
        travelled = maxAlong;
        break;
      }
      travelled += seg;
      target = line[i];
    }
    const dx = target[0] - at[0];
    const dy = target[1] - at[1];
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const key = `${at[0].toFixed(2)},${at[1].toFixed(2)}`;
    const node = nodes.get(key) ?? { at, arms: [] };
    node.arms.push({ dir: [dx / len, dy / len], angle: Math.atan2(dy, dx), reach: len });
    nodes.set(key, node);
  };
  for (const f of roads.features) {
    const parts = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const part of parts) {
      const line = part.map((c) => proj.toXy(c as [number, number]));
      if (line.length < 2) continue;
      addArm(line);
      addArm([...line].reverse());
    }
  }

  const features: FilletCollection['features'] = [];
  for (const { at, arms } of nodes.values()) {
    if (arms.length < 2) continue;
    arms.sort((p, q) => p.angle - q.angle);
    for (let i = 0; i < arms.length; i++) {
      const a = arms[i];
      const b = arms[(i + 1) % arms.length];
      let wedge = b.angle - a.angle;
      if (i === arms.length - 1) wedge += 2 * Math.PI;
      const ring = fillet(at, a, b, wedge, halfWidth, radius);
      if (ring) {
        features.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [ring.map(proj.toLngLat)] },
        });
      }
    }
  }
  return { type: 'FeatureCollection', features };
}

/** The patch filling the corner between arm `a` and arm `b` (b is `wedge` radians counter-clockwise of a). */
function fillet(p: Xy, a: Arm, b: Arm, wedge: number, w: number, maxR: number): Xy[] | null {
  if (wedge <= 0.05 || wedge >= MAX_WEDGE) return null;
  const half = wedge / 2;
  // Tangent points sit (w + r) / tan(half) along each arm; shrink r so they
  // stay within the straight stretch the arm was measured over.
  const room = Math.min(a.reach, b.reach);
  const r = Math.min(maxR, room * Math.tan(half) - w);
  if (r < 1) return null;
  const along = (w + r) / Math.tan(half);
  const na: Xy = [-a.dir[1], a.dir[0]]; // a's side facing b
  const nb: Xy = [b.dir[1], -b.dir[0]]; // b's side facing a
  const bis0 = a.dir[0] + b.dir[0];
  const bis1 = a.dir[1] + b.dir[1];
  const bl = Math.hypot(bis0, bis1);
  const u: Xy = [bis0 / bl, bis1 / bl];

  const corner: Xy = [p[0] + (u[0] * w) / Math.sin(half), p[1] + (u[1] * w) / Math.sin(half)];
  const center: Xy = [p[0] + (u[0] * (w + r)) / Math.sin(half), p[1] + (u[1] * (w + r)) / Math.sin(half)];
  const ta: Xy = [p[0] + a.dir[0] * along + na[0] * w, p[1] + a.dir[1] * along + na[1] * w];
  const tb: Xy = [p[0] + b.dir[0] * along + nb[0] * w, p[1] + b.dir[1] * along + nb[1] * w];

  const from = Math.atan2(ta[1] - center[1], ta[0] - center[0]);
  let sweep = Math.atan2(tb[1] - center[1], tb[0] - center[0]) - from;
  // The arc facing the junction is the short one.
  if (sweep > Math.PI) sweep -= 2 * Math.PI;
  if (sweep < -Math.PI) sweep += 2 * Math.PI;
  const ring: Xy[] = [corner, ta];
  for (let k = 1; k < ARC_STEPS; k++) {
    const t = from + (sweep * k) / ARC_STEPS;
    ring.push([center[0] + r * Math.cos(t), center[1] + r * Math.sin(t)]);
  }
  ring.push(tb, corner);
  return ring;
}
