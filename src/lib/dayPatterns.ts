import type { PatternId } from '../domain/decor';
import { HEART_PATH, STAR_PATH } from './pingPaths';

/**
 * Background patterns for a day (꾸미기), as one repeating tile each, so the
 * screen (an SVG <pattern>) and the share image (canvas) draw the same thing.
 * Sizes are CSS pixels. `flow` is how far the tile drifts per loop: the
 * screen slides it by exactly one tile so the loop has no seam; the share
 * image is a still frame.
 */
export interface PatternMark {
  d: string;
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  /** The path's own centre (both axes), so it turns and scales in place. */
  origin?: number;
}

export interface PatternTile {
  size: number;
  marks: PatternMark[];
  /** Outlines rather than filled shapes, at this width. */
  stroke?: number;
  flow?: { x: number; y: number; seconds: number };
  /** One upright rule at `x` from the area's left edge (not repeated): a notebook's margin. */
  margin?: { x: number; width: number };
}

const dot = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

/** Small seeded random numbers: the same scatter every time, on screen and in the image. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Scatter {
  /** Marks to place: a path (drawn in a 24-unit box) or a dot, and its size range. */
  kind: { path: string } | 'dot';
  count: number;
  /** Radius range in px (for a path: half its drawn size). */
  r: [number, number];
  /** Largest turn either way, degrees. */
  turn?: number;
}

/**
 * Scattered marks over a big tile, so hearts, stars and snow fall unevenly
 * instead of in a visible grid. Spacing is measured around the tile's
 * wrap-around, so neighbours across a seam keep their distance too, and
 * marks stay clear of the edges (a tile clips what crosses them).
 */
function scatter(seed: number, size: number, groups: Scatter[]): PatternMark[] {
  const rnd = seeded(seed);
  const placed: { x: number; y: number; r: number }[] = [];
  const marks: PatternMark[] = [];
  const far = (x: number, y: number, r: number) =>
    placed.every((p) => {
      const dx = Math.min(Math.abs(p.x - x), size - Math.abs(p.x - x));
      const dy = Math.min(Math.abs(p.y - y), size - Math.abs(p.y - y));
      return Math.hypot(dx, dy) > (p.r + r) * 1.6 + 10;
    });
  for (const g of groups) {
    for (let i = 0; i < g.count; i++) {
      for (let tries = 0; tries < 60; tries++) {
        const r = g.r[0] + rnd() * (g.r[1] - g.r[0]);
        const x = r + 1 + rnd() * (size - 2 * r - 2);
        const y = r + 1 + rnd() * (size - 2 * r - 2);
        if (!far(x, y, r)) continue;
        placed.push({ x, y, r });
        if (g.kind === 'dot') marks.push({ d: dot(x, y, r) });
        else marks.push({ d: g.kind.path, x, y, scale: r / 12, rotate: (rnd() * 2 - 1) * (g.turn ?? 0), origin: 12 });
        break;
      }
    }
  }
  return marks;
}

// Spaced out and bold enough to read at a glance on the page, like the
// previews in the 꾸미기 sheet, while staying a backdrop.
export const PATTERN_TILES: Record<Exclude<PatternId, 'none'>, PatternTile> = {
  dots: { size: 44, marks: [{ d: dot(11, 11, 4) }, { d: dot(33, 33, 4) }] },
  grid: { size: 44, stroke: 2, marks: [{ d: 'M0 1H44M1 0V44' }] },
  stripes: {
    size: 36,
    stroke: 7,
    marks: [{ d: 'M-9 9L9 -9M0 36L36 0M27 45L45 27' }],
    flow: { x: 36, y: 0, seconds: 4 },
  },
  waves: {
    size: 64,
    stroke: 4,
    marks: [{ d: 'M0 16Q16 6 32 16T64 16' }, { d: 'M0 48Q16 38 32 48T64 48' }],
    flow: { x: 64, y: 0, seconds: 5 },
  },
  // Scattered over a big tile rather than in rows (see `scatter`).
  hearts: {
    size: 320,
    marks: scatter(7, 320, [{ kind: { path: HEART_PATH }, count: 12, r: [7, 15], turn: 25 }]),
    flow: { x: 0, y: -320, seconds: 32 },
  },
  stars: {
    size: 320,
    marks: scatter(11, 320, [
      { kind: { path: STAR_PATH }, count: 11, r: [6, 13], turn: 36 },
      { kind: 'dot', count: 12, r: [1.6, 3.2] },
    ]),
    flow: { x: -320, y: 0, seconds: 44 },
  },
  snow: {
    size: 320,
    marks: scatter(3, 320, [{ kind: 'dot', count: 22, r: [2.2, 7] }]),
    flow: { x: 0, y: 320, seconds: 29 },
  },
  // A notebook's ruled lines, and its margin rule down the left once.
  notes: { size: 30, marks: [{ d: 'M0 28H30V30H0Z' }], margin: { x: 40, width: 2 } },
};

/** SVG transform for a mark within its tile. */
export const markTransform = (m: PatternMark): string =>
  `translate(${m.x ?? 0} ${m.y ?? 0}) rotate(${m.rotate ?? 0}) scale(${m.scale ?? 1}) translate(${-(m.origin ?? 0)} ${-(m.origin ?? 0)})`;

/**
 * Tiles a canvas area with a pattern, still. `unit` is canvas pixels per CSS
 * pixel, so the image shows the pattern about as dense as a phone does.
 */
export function paintPattern(
  ctx: CanvasRenderingContext2D,
  id: PatternId,
  area: { w: number; h: number },
  unit: number,
  color: string,
) {
  if (id === 'none') return;
  const tile = PATTERN_TILES[id];
  const paths = tile.marks.map((m) => ({ m, path: new Path2D(m.d) }));
  ctx.save();
  ctx.scale(unit, unit);
  ctx.globalAlpha = PATTERN_ALPHA;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  if (tile.stroke) ctx.lineWidth = tile.stroke;
  for (let ty = 0; ty < area.h / unit; ty += tile.size) {
    for (let tx = 0; tx < area.w / unit; tx += tile.size) {
      for (const { m, path } of paths) {
        ctx.save();
        ctx.translate(tx + (m.x ?? 0), ty + (m.y ?? 0));
        ctx.rotate(((m.rotate ?? 0) * Math.PI) / 180);
        ctx.scale(m.scale ?? 1, m.scale ?? 1);
        ctx.translate(-(m.origin ?? 0), -(m.origin ?? 0));
        if (tile.stroke) ctx.stroke(path);
        else ctx.fill(path);
        ctx.restore();
      }
    }
  }
  if (tile.margin) ctx.fillRect(tile.margin.x, 0, tile.margin.width, area.h / unit);
  ctx.restore();
}

/** How strongly a pattern shows: a backdrop, never competing with the pings. */
export const PATTERN_ALPHA = 0.22;
