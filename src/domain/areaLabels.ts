import type { AreaLabel, AreaShapes, AreaTag } from './adminAreas';
import type { PolygonRings } from './baseMap';
import type { MapViewport } from './districtMap';
import { screenProjection } from './districtRendering';

/** Label box estimate (px): one Hangul glyph of the 13px label, plus padding. */
const CHAR_PX = 13;
const LABEL_PAD_PX = 10;
export const LABEL_HEIGHT_PX = 20;
/** Labels keep this far from the screen edges (px). */
const EDGE_PX = 6;
/** Horizontal lines tried across an area when looking for room. */
const SCAN_LINES = 9;

export const labelWidthPx = (name: string) => name.length * CHAR_PX + LABEL_PAD_PX;

/** Screen edges (px) hidden under the app's own bars and buttons. */
export interface LabelCover { top: number; right: number; bottom: number; left: number }
const NO_COVER: LabelCover = { top: 0, right: 0, bottom: 0, left: 0 };

type Px = [number, number];
type PxRing = Px[];

/** Even-odd crossings of all rings with a horizontal (axis 1) or vertical (axis 0) line. */
function crossings(rings: PxRing[], axis: 0 | 1, at: number): number[] {
  const other = axis === 1 ? 0 : 1;
  const out: number[] = [];
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], b = ring[i];
      if (a[axis] > at !== b[axis] > at) out.push(a[other] + ((at - a[axis]) * (b[other] - a[other])) / (b[axis] - a[axis]));
    }
  }
  return out.sort((x, y) => x - y);
}

/** The inside run of the line through `p` that holds it, or null when `p` is outside. */
function runAt(rings: PxRing[], axis: 0 | 1, p: Px): [number, number] | null {
  const xs = crossings(rings, axis, p[axis]);
  const along = p[axis === 1 ? 0 : 1];
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i] <= along && along <= xs[i + 1]) return [xs[i], xs[i + 1]];
  return null;
}

/** Screen bounds in label space; `top` is just the smaller y. */
interface Screen { left: number; top: number; right: number; bottom: number }

/** Whether a label of this size centered on `p` fits inside the area and on screen. */
function fits(rings: PxRing[], p: Px, w: number, screen: Screen): boolean {
  if (p[0] - w / 2 < screen.left || p[0] + w / 2 > screen.right ||
    p[1] - LABEL_HEIGHT_PX / 2 < screen.top || p[1] + LABEL_HEIGHT_PX / 2 > screen.bottom) return false;
  // Checked along both of the box's middle lines and its top and bottom edges.
  const across = [p[1] - LABEL_HEIGHT_PX / 2, p[1], p[1] + LABEL_HEIGHT_PX / 2].map((y) => runAt(rings, 1, [p[0], y]));
  if (across.some((run) => !run || run[0] > p[0] - w / 2 || run[1] < p[0] + w / 2)) return false;
  const down = runAt(rings, 0, p);
  return !!down && down[0] <= p[1] - LABEL_HEIGHT_PX / 2 && down[1] >= p[1] + LABEL_HEIGHT_PX / 2;
}

/**
 * The roomiest spot for a label inside the visible part of an area: on a few
 * horizontal lines across it, the middle of the widest inside run that
 * leaves the label room above and below.
 */
function bestSpot(rings: PxRing[], w: number, screen: Screen): Px | null {
  let top = Infinity, bottom = -Infinity;
  for (const ring of rings) for (const [, y] of ring) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  top = Math.max(top, screen.top + LABEL_HEIGHT_PX / 2);
  bottom = Math.min(bottom, screen.bottom - LABEL_HEIGHT_PX / 2);
  if (!(bottom > top)) return null;
  let best: Px | null = null;
  let bestScore = -Infinity;
  for (let k = 0; k < SCAN_LINES; k++) {
    const y = top + ((bottom - top) * (k + 0.5)) / SCAN_LINES;
    const xs = crossings(rings, 1, y);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const left = Math.max(xs[i], screen.left), right = Math.min(xs[i + 1], screen.right);
      if (right - left < w) continue;
      const p: Px = [(left + right) / 2, y];
      if (!fits(rings, p, w, screen)) continue;
      // Wide runs first; among similar ones, the line nearest the middle.
      const score = right - left - Math.abs(k - (SCAN_LINES - 1) / 2) * 4;
      if (score > bestScore) { bestScore = score; best = p; }
    }
  }
  return best;
}

/**
 * One name label per area that has room for it on screen. A label that
 * still fits where it was stays put, so labels don't hop about while the map
 * is panned over the same shapes.
 */
export function placeAreaLabels(
  shapes: AreaShapes,
  viewport: MapViewport,
  previous: AreaLabel[] = [],
  cover: LabelCover = NO_COVER,
): AreaLabel[] {
  const { bounds, widthPx } = viewport;
  if (!(widthPx > 0 && bounds.east > bounds.west && bounds.north > bounds.south)) return [];
  const projection = screenProjection(viewport);
  const raw = ([x, y]: [number, number]): Px => {
    const p = projection.project([x, y]);
    return [p.X / 100, p.Y / 100];
  };
  // Worked out in screen axes around the screen center (y up), so a label's
  // box stays upright on a turned map.
  const [cx, cy0] = raw([bounds.west, bounds.north]);
  const [, cy1] = raw([bounds.east, bounds.south]);
  const center: Px = [cx + widthPx / 2, (cy0 + cy1) / 2];
  const turn = ((viewport.screen?.bearing ?? 0) * Math.PI) / 180;
  const cos = Math.cos(turn), sin = Math.sin(turn);
  const px = (p: [number, number]): Px => {
    const [x, y] = raw(p);
    const dx = x - center[0], dy = y - center[1];
    return [dx * cos - dy * sin, dx * sin + dy * cos];
  };
  const toLonLat = ([sx, sy]: Px) => projection.unproject({
    X: (center[0] + sx * cos + sy * sin) * 100,
    Y: (center[1] - sx * sin + sy * cos) * 100,
  });
  const halfW = (viewport.screen?.width ?? widthPx) / 2;
  const halfH = (viewport.screen?.height ?? Math.abs(cy0 - cy1)) / 2;
  // Label space has y up: the screen's top edge is the larger y.
  const screen: Screen = {
    left: -halfW + cover.left + EDGE_PX, right: halfW - cover.right - EDGE_PX,
    top: -halfH + cover.bottom + EDGE_PX, bottom: halfH - cover.top - EDGE_PX,
  };
  if (!(screen.right > screen.left && screen.bottom > screen.top)) return [];
  const groups = new Map<string, { tag: AreaTag; part: boolean; polygons: PolygonRings[] }>();
  const gather = (polygons: PolygonRings[], tags: AreaTag[] | undefined, part: boolean) => {
    if (!tags || tags.length !== polygons.length) return;
    polygons.forEach((polygon, i) => {
      const id = `${part ? 'p' : 'o'}:${tags[i].key}`;
      const group = groups.get(id) ?? { tag: tags[i], part, polygons: [] };
      group.polygons.push(polygon);
      groups.set(id, group);
    });
  };
  gather(shapes.parts, shapes.partTags, true);
  gather(shapes.others, shapes.otherTags, false);
  const before = new Map(previous.map((l) => [`${l.part ? 'p' : 'o'}:${l.key}`, l]));
  const labels: AreaLabel[] = [];
  for (const [id, { tag, part, polygons }] of groups) {
    if (!tag.name) continue;
    const w = labelWidthPx(tag.name);
    const rings = polygons.flatMap((polygon) => polygon.map((ring) => ring.map(px)));
    const old = before.get(id);
    if (old && old.name === tag.name && fits(rings, px(old.at), w, screen)) {
      labels.push(old);
      continue;
    }
    const spot = bestSpot(rings, w, screen);
    if (spot) labels.push({ key: tag.key, name: tag.name, part, at: toLonLat(spot) });
  }
  return labels;
}

export const sameLabels = (a: AreaLabel[] | undefined, b: AreaLabel[] | undefined): boolean =>
  (a ?? []).length === (b ?? []).length &&
  (a ?? []).every((l, i) => {
    const m = b![i];
    return l.key === m.key && l.part === m.part && l.name === m.name && l.at[0] === m.at[0] && l.at[1] === m.at[1];
  });
