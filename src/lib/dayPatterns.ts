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
}

export interface PatternTile {
  size: number;
  marks: PatternMark[];
  /** Outlines rather than filled shapes, at this width. */
  stroke?: number;
  flow?: { x: number; y: number; seconds: number };
}

const dot = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

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
  hearts: {
    size: 80,
    marks: [
      { d: HEART_PATH, x: 8, y: 8, scale: 1 },
      { d: HEART_PATH, x: 48, y: 46, scale: 0.75, rotate: -12 },
    ],
    flow: { x: 0, y: -80, seconds: 8 },
  },
  stars: {
    size: 88,
    marks: [
      { d: STAR_PATH, x: 10, y: 12, scale: 0.95 },
      { d: STAR_PATH, x: 54, y: 54, scale: 0.65, rotate: 18 },
      { d: dot(74, 18, 3) },
      { d: dot(24, 70, 2.4) },
    ],
    flow: { x: -88, y: 0, seconds: 12 },
  },
  snow: {
    size: 100,
    marks: [{ d: dot(16, 20, 5.5) }, { d: dot(64, 10, 3.6) }, { d: dot(44, 58, 6.5) }, { d: dot(84, 74, 4.4) }, { d: dot(14, 84, 3.2) }],
    flow: { x: 0, y: 100, seconds: 9 },
  },
};

/** SVG transform for a mark within its tile. */
export const markTransform = (m: PatternMark): string =>
  `translate(${m.x ?? 0} ${m.y ?? 0}) rotate(${m.rotate ?? 0}) scale(${m.scale ?? 1})`;

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
        if (tile.stroke) ctx.stroke(path);
        else ctx.fill(path);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

/** How strongly a pattern shows: a backdrop, never competing with the pings. */
export const PATTERN_ALPHA = 0.22;
