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

/** A pin's footprint above its point (`.ping`'s --w / --h), and the gaps to its info (screen px at the day screen's size). */
const PIN_W = 34;
const PIN_H = 44;
const PIN_GAP = 5;

/**
 * Roughly how big a ping's info (name, and time under it) is, from its text,
 * as the day screen draws it (measured: a 13px line is 19px tall, the time
 * line under it 18px; the tall narrow font gives a letter about 0.8em). A
 * little too big is safe, too small lets names touch.
 */
export function pingInfoSize(name: string, time: string | undefined, latest = false): { w: number; h: number } {
  const em = latest ? 15 : 13;
  return { w: Math.max([...name].length * em * 0.8, time ? 38 : 0, 24), h: (name ? em + 6 : 0) + (time ? 18 : 0) };
}

const pinRect = (at: Pt): Rect => ({ l: at.x - PIN_W / 2, t: at.y - PIN_H, r: at.x + PIN_W / 2, b: at.y });

/**
 * Where a ping's name / time goes around its pin. The four of a route's
 * stops (below first, as everywhere in the app), then the corners, which let
 * crowded names slip past one another: below-right starts at the point and
 * runs right, above-right sits off the pin's head (Imhof's favourite place).
 */
export type PingLabelSide = LabelSide | 'below-right' | 'below-left' | 'above-right' | 'above-left';

export const PING_LABEL_SIDES: PingLabelSide[] = ['below', 'above', 'right', 'left', 'below-right', 'below-left', 'above-right', 'above-left'];

/** How far a corner name tucks in under the pin's head or past its point (px). */
const CORNER_TUCK = 4;
const POINT_TUCK = 6;

/** Where a ping's info of `size` sits for each side of its pin. */
function infoRect(at: Pt, size: { w: number; h: number }, side: PingLabelSide): Rect {
  const { w, h } = size;
  const mid = at.y - PIN_H / 2;
  const head = at.y - PIN_H + CORNER_TUCK;
  switch (side) {
    case 'below':
      return { l: at.x - w / 2, t: at.y + PIN_GAP, r: at.x + w / 2, b: at.y + PIN_GAP + h };
    case 'above':
      return { l: at.x - w / 2, t: at.y - PIN_H - PIN_GAP - h, r: at.x + w / 2, b: at.y - PIN_H - PIN_GAP };
    case 'right':
      return { l: at.x + PIN_W / 2 + PIN_GAP, t: mid - h / 2, r: at.x + PIN_W / 2 + PIN_GAP + w, b: mid + h / 2 };
    case 'left':
      return { l: at.x - PIN_W / 2 - PIN_GAP - w, t: mid - h / 2, r: at.x - PIN_W / 2 - PIN_GAP, b: mid + h / 2 };
    case 'below-right':
      return { l: at.x - POINT_TUCK, t: at.y + PIN_GAP, r: at.x - POINT_TUCK + w, b: at.y + PIN_GAP + h };
    case 'below-left':
      return { l: at.x + POINT_TUCK - w, t: at.y + PIN_GAP, r: at.x + POINT_TUCK, b: at.y + PIN_GAP + h };
    case 'above-right':
      return { l: at.x + PIN_W / 2 - CORNER_TUCK, t: head - h, r: at.x + PIN_W / 2 - CORNER_TUCK + w, b: head };
    case 'above-left':
      return { l: at.x - PIN_W / 2 + CORNER_TUCK - w, t: head - h, r: at.x - PIN_W / 2 + CORNER_TUCK, b: head };
  }
}

const overlapArea = (a: Rect, b: Rect) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

/** How long a stretch of the segment a–b runs inside the rect (Liang–Barsky). */
function lengthInside(a: Pt, b: Pt, r: Rect): number {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  let [t0, t1] = [0, 1];
  const edges: [number, number][] = [[-dx, a.x - r.l], [dx, r.r - a.x], [-dy, a.y - r.t], [dy, r.b - a.y]];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return 0;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return 0;
  }
  return (t1 - t0) * Math.hypot(dx, dy);
}

/** What a px of line running under a name costs, against a px² of overlap: a crossed name is hard to read. */
const LINE_COST = 6;
/** What each step down the list of sides costs: only enough to settle a tie. */
const RANK_COST = 2;
const ROUNDS = 8;

/**
 * The side of each ping's pin for its info, chosen so that nothing covers
 * anything else (a map's names after Imhof): the cost of a side is how much
 * its info overlaps the other infos and pins, how much route line runs under
 * it, and a little for being further down the list. Each ping first takes
 * its cheapest side in visiting order; then every ping in turn moves to the
 * cheapest side given all the others, until none moves.
 */
export function placePingLabels(points: Pt[], sizes: { w: number; h: number }[]): PingLabelSide[] {
  const pins = points.map(pinRect);
  const segments = points.slice(1).map((b, i) => [points[i], b] as const);
  const options = points.map((at, i) => PING_LABEL_SIDES.map((side) => infoRect(at, sizes[i], side)));
  // What does not depend on the other infos: the pins, the lines, the preference.
  const fixed = options.map((list, i) =>
    list.map(
      (rect, k) =>
        pins.reduce((sum, pin, j) => (j === i ? sum : sum + overlapArea(rect, pin)), 0) +
        LINE_COST * segments.reduce((sum, [a, b]) => sum + lengthInside(a, b, rect), 0) +
        RANK_COST * k,
    ),
  );
  const pick: (number | undefined)[] = points.map(() => undefined);
  const cost = (i: number, k: number) =>
    fixed[i][k] + pick.reduce<number>((sum, other, j) => (j === i || other === undefined ? sum : sum + overlapArea(options[i][k], options[j][other])), 0);
  const cheapest = (i: number) => options[i].reduce((best, _, k) => (cost(i, k) < cost(i, best) ? k : best), 0);
  points.forEach((_, i) => (pick[i] = cheapest(i)));
  for (let round = 0; round < ROUNDS; round++) {
    let moved = false;
    points.forEach((_, i) => {
      const best = cheapest(i);
      if (cost(i, best) < cost(i, pick[i]!)) {
        pick[i] = best;
        moved = true;
      }
    });
    if (!moved) break;
  }
  return pick.map((k) => PING_LABEL_SIDES[k!]);
}

/** How much each ping's info covers the other infos and pins (px²) with these sides. */
function infoOverlaps(points: Pt[], sizes: { w: number; h: number }[], sides: PingLabelSide[]): number[] {
  const infos = points.map((at, i) => infoRect(at, sizes[i], sides[i]));
  const pins = points.map(pinRect);
  return infos.map((info, i) => infos.reduce((sum, other, j) => (j === i ? sum : sum + overlapArea(info, other) + overlapArea(info, pins[j])), 0));
}

/** A ping's info as it would be written: its name, its time (if any), and whether it is the latest (drawn bigger). */
export interface PingInfo {
  name: string;
  time?: string;
  latest?: boolean;
}

/** A name cut to fit ends in this, and keeps at least this many letters. */
const ELLIPSIS = '…';
const MIN_LETTERS = 3;

/**
 * Where each ping's info goes, and what of it is written. Placed as
 * `placePingLabels`; an info that still covers something gives up its time
 * first (the latest ping keeps it: it is the one being told about), and if
 * that is not enough its name is cut short.
 */
export function fitPingLabels(points: Pt[], infos: PingInfo[]): { side: PingLabelSide; name: string; time?: string }[] {
  let shown = infos.map((info) => ({ ...info }));
  const size = (info: PingInfo) => pingInfoSize(info.name, info.time, info.latest);
  let sides = placePingLabels(points, shown.map(size));
  const steps: ((info: PingInfo) => PingInfo)[] = [
    (info) => (info.time && !info.latest ? { ...info, time: undefined } : info),
    (info) => {
      const letters = [...info.name];
      if (letters.length <= MIN_LETTERS + 1) return info;
      return { ...info, name: letters.slice(0, Math.max(MIN_LETTERS, Math.ceil(letters.length * 0.6))).join('') + ELLIPSIS };
    },
  ];
  for (const step of steps) {
    const crowded = infoOverlaps(points, shown.map(size), sides);
    if (crowded.every((c) => c === 0)) break;
    shown = shown.map((info, i) => (crowded[i] > 0 ? step(info) : info));
    sides = placePingLabels(points, shown.map(size));
  }
  return shown.map((info, i) => ({ side: sides[i], name: info.name, time: info.time }));
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
