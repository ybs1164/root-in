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

// --- A day's pings: the pin stands up from its point and its name / time sits beside it. ---

/** A pin's footprint above its point, and the gaps to its info (screen px at the day screen's size). */
const PIN_W = 30;
const PIN_H = 46;
const PIN_GAP = 5;

/** Roughly how big a ping's info (name, and time under it) is, from its text. */
export function pingInfoSize(name: string, time: string | undefined, latest = false): { w: number; h: number } {
  const em = latest ? 15 : 13;
  return { w: Math.max(name.length * em * 1.02, time ? 38 : 0, 24), h: (name ? em + 3 : 0) + (time ? 15 : 0) };
}

const pinRect = (at: Pt): Rect => ({ l: at.x - PIN_W / 2, t: at.y - PIN_H, r: at.x + PIN_W / 2, b: at.y });

/** Where a ping's info of `size` sits for each side of its pin. */
function infoRect(at: Pt, size: { w: number; h: number }, side: LabelSide): Rect {
  const { w, h } = size;
  const mid = at.y - PIN_H / 2;
  switch (side) {
    case 'below':
      return { l: at.x - w / 2, t: at.y + PIN_GAP, r: at.x + w / 2, b: at.y + PIN_GAP + h };
    case 'above':
      return { l: at.x - w / 2, t: at.y - PIN_H - PIN_GAP - h, r: at.x + w / 2, b: at.y - PIN_H - PIN_GAP };
    case 'right':
      return { l: at.x + PIN_W / 2 + PIN_GAP, t: mid - h / 2, r: at.x + PIN_W / 2 + PIN_GAP + w, b: mid + h / 2 };
    case 'left':
      return { l: at.x - PIN_W / 2 - PIN_GAP - w, t: mid - h / 2, r: at.x - PIN_W / 2 - PIN_GAP, b: mid + h / 2 };
  }
}

const overlapArea = (a: Rect, b: Rect) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

/**
 * The side of each ping's pin for its info, chosen so that nothing covers
 * anything else: an info keeps off the other infos already placed and off
 * every other pin, and (as `labelSide`) off the lines out of its own pin. It
 * takes the first such side (below, above, right, left); where none is clear,
 * the side that overlaps least.
 */
export function placePingLabels(points: Pt[], sizes: { w: number; h: number }[]): LabelSide[] {
  const placed: Rect[] = [];
  const pins = points.map(pinRect);
  return points.map((at, i) => {
    const near = [points[i - 1], points[i + 1]].filter((p): p is Pt => !!p);
    const cost = (side: LabelSide) => {
      const rect = infoRect(at, sizes[i], side);
      return placed.reduce((sum, p) => sum + overlapArea(rect, p), 0) + pins.reduce((sum, pin, j) => (j === i ? sum : sum + overlapArea(rect, pin)), 0);
    };
    const order = SIDES.map((x) => x.side);
    const clearOfLines = SIDES.filter((x) => clearOf(at, near, x.dir)).map((x) => x.side);
    const candidates = [...clearOfLines, ...order.filter((x) => !clearOfLines.includes(x))];
    const best = candidates.reduce((pick, side) => (cost(side) < cost(pick) ? side : pick), candidates[0]);
    placed.push(infoRect(at, sizes[i], best));
    return best;
  });
}

/** How much the pins and their infos cover one another (px²) once placed: 0 is a clean picture. */
export function pingOverlap(points: Pt[], sizes: { w: number; h: number }[]): number {
  const sides = placePingLabels(points, sizes);
  const infos = points.map((at, i) => infoRect(at, sizes[i], sides[i]));
  const pins = points.map(pinRect);
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      if (j > i) total += overlapArea(pins[i], pins[j]) + overlapArea(infos[i], infos[j]);
      if (j !== i) total += overlapArea(infos[i], pins[j]);
    }
  }
  return total;
}
