/** A point in Clipper's integer screen units (hundredths of a pixel). */
export interface CurvePoint {
  X: number;
  Y: number;
}

/**
 * A closed outline redrawn as one continuous curve through its points
 * (centripetal Catmull-Rom, docs/plan-mainmap-style.md M11): the curvature
 * runs on without breaks, as on simplified city maps, where corner rounding
 * alone left straight runs with bends between them. Centripetal (α = 0.5)
 * keeps the curve from looping or overshooting at tight corners. Sampled
 * about every `stepUnits` along the way, never fewer than 2 per span.
 */
export function smoothClosed(path: CurvePoint[], stepUnits: number): CurvePoint[] {
  if (path.length < 4) return path;
  // Long straight spans get points along them first (every `MAX_SPAN_STEPS`
  // samples): the curve's tangent at a span's ends comes from its neighbours,
  // and across one long span a bend's tangent bowed the straight edge.
  path = densify(path, stepUnits * MAX_SPAN_STEPS);
  const n = path.length;
  const out: CurvePoint[] = [];
  const knot = (a: CurvePoint, b: CurvePoint) => Math.sqrt(Math.hypot(b.X - a.X, b.Y - a.Y)) || 1e-6;
  for (let i = 0; i < n; i++) {
    const p0 = path[(i - 1 + n) % n], p1 = path[i], p2 = path[(i + 1) % n], p3 = path[(i + 2) % n];
    const t1 = knot(p0, p1);
    const t2 = t1 + knot(p1, p2);
    const t3 = t2 + knot(p2, p3);
    const span = Math.hypot(p2.X - p1.X, p2.Y - p1.Y);
    const steps = Math.max(2, Math.ceil(span / stepUnits));
    for (let s = 0; s < steps; s++) {
      const t = t1 + ((t2 - t1) * s) / steps;
      // Barry–Goldman pyramid for the non-uniform Catmull-Rom.
      const lerp = (a: CurvePoint, b: CurvePoint, ta: number, tb: number) => {
        const w = tb - ta || 1e-6;
        return { X: ((tb - t) / w) * a.X + ((t - ta) / w) * b.X, Y: ((tb - t) / w) * a.Y + ((t - ta) / w) * b.Y };
      };
      const a1 = lerp(p0, p1, 0, t1);
      const a2 = lerp(p1, p2, t1, t2);
      const a3 = lerp(p2, p3, t2, t3);
      const b1 = lerp(a1, a2, 0, t2);
      const b2 = lerp(a2, a3, t1, t3);
      const c = lerp(b1, b2, t1, t2);
      out.push({ X: Math.round(c.X), Y: Math.round(c.Y) });
    }
  }
  return out;
}

/** A span longer than this many samples is split, so straight edges stay straight. */
const MAX_SPAN_STEPS = 3;

/** Points added along every span longer than `maxSpan`, evenly. */
function densify(path: CurvePoint[], maxSpan: number): CurvePoint[] {
  const out: CurvePoint[] = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    out.push(a);
    const pieces = Math.ceil(Math.hypot(b.X - a.X, b.Y - a.Y) / maxSpan);
    for (let k = 1; k < pieces; k++) out.push({ X: Math.round(a.X + ((b.X - a.X) * k) / pieces), Y: Math.round(a.Y + ((b.Y - a.Y) * k) / pieces) });
  }
  return out;
}
