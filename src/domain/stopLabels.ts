/** Where a stop's name goes beside it: below by default, like a day's pings. */
export type LabelSide = 'below' | 'above' | 'right' | 'left';

type Pt = { x: number; y: number };

// In order of preference; screen coordinates (y grows down).
const SIDES: { side: LabelSide; dir: Pt }[] = [
  { side: 'below', dir: { x: 0, y: 1 } },
  { side: 'above', dir: { x: 0, y: -1 } },
  { side: 'right', dir: { x: 1, y: 0 } },
  { side: 'left', dir: { x: -1, y: 0 } },
];

/** A line leaving within this angle of a side's direction would run through a name put there. */
const CLEAR_DEG = 50;

/**
 * The side for a stop's name that no line out of it runs through: its
 * lines go to the stops before and after it (`neighbours`, screen points).
 * Below unless a line heads that way; then above, right, left. With every
 * side crossed, the one whose nearest line is furthest off.
 */
export function labelSide(at: Pt, neighbours: Pt[]): LabelSide {
  const dirs = neighbours
    .map((n) => ({ x: n.x - at.x, y: n.y - at.y }))
    .filter((d) => d.x !== 0 || d.y !== 0)
    .map((d) => {
      const len = Math.hypot(d.x, d.y);
      return { x: d.x / len, y: d.y / len };
    });
  const clearance = (dir: Pt) =>
    Math.min(180, ...dirs.map((d) => (Math.acos(Math.max(-1, Math.min(1, d.x * dir.x + d.y * dir.y))) * 180) / Math.PI));
  const clear = SIDES.find((s) => clearance(s.dir) >= CLEAR_DEG);
  if (clear) return clear.side;
  return SIDES.reduce((best, s) => (clearance(s.dir) > clearance(best.dir) ? s : best)).side;
}

/** Gap from a stop's centre to its name (the numbered marker is 32px across). */
export const LABEL_GAP = 22;
/** A marker's radius, which another stop's name should keep off. */
const MARKER_R = 17;

type Rect = { l: number; t: number; r: number; b: number };

/** Where a name of `size` sits for each side of the stop at `at` (screen px). */
export function labelRect(at: Pt, size: { w: number; h: number }, side: LabelSide): Rect {
  const { w, h } = size;
  switch (side) {
    case 'below':
      return { l: at.x - w / 2, t: at.y + LABEL_GAP, r: at.x + w / 2, b: at.y + LABEL_GAP + h };
    case 'above':
      return { l: at.x - w / 2, t: at.y - LABEL_GAP - h, r: at.x + w / 2, b: at.y - LABEL_GAP };
    case 'right':
      return { l: at.x + LABEL_GAP, t: at.y - h / 2, r: at.x + LABEL_GAP + w, b: at.y + h / 2 };
    case 'left':
      return { l: at.x - LABEL_GAP - w, t: at.y - h / 2, r: at.x - LABEL_GAP, b: at.y + h / 2 };
  }
}

const overlaps = (a: Rect, b: Rect) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/**
 * Sides for every stop's name along a route (`points` in order, `sizes` of
 * their names): each stays off the lines out of its stop (as `labelSide`),
 * off the names already placed and off the other stops' markers, trying
 * below, above, right, left. Where nothing is clear, the lines win: a name
 * may touch another name before it crosses a line.
 */
export function placeLabels(points: Pt[], sizes: { w: number; h: number }[]): LabelSide[] {
  const placed: Rect[] = [];
  const markers: Rect[] = points.map((p) => ({ l: p.x - MARKER_R, t: p.y - MARKER_R, r: p.x + MARKER_R, b: p.y + MARKER_R }));
  return points.map((at, i) => {
    const near = [points[i - 1], points[i + 1]].filter((p): p is Pt => !!p);
    const lineSide = labelSide(at, near);
    const clearOfLines = SIDES.filter((s) => clearOf(at, near, s.dir)).map((s) => s.side);
    const free = (side: LabelSide) => {
      const rect = labelRect(at, sizes[i], side);
      return !placed.some((p) => overlaps(rect, p)) && !markers.some((m, j) => j !== i && overlaps(rect, m));
    };
    const side = clearOfLines.find(free) ?? SIDES.map((s) => s.side).find(free) ?? lineSide;
    placed.push(labelRect(at, sizes[i], side));
    return side;
  });
}

/** True when no line out of `at` (to `near`) runs within CLEAR_DEG of `dir`. */
function clearOf(at: Pt, near: Pt[], dir: Pt): boolean {
  return near.every((n) => {
    const d = { x: n.x - at.x, y: n.y - at.y };
    const len = Math.hypot(d.x, d.y);
    if (!len) return true;
    const cos = (d.x * dir.x + d.y * dir.y) / len;
    return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI >= CLEAR_DEG;
  });
}
