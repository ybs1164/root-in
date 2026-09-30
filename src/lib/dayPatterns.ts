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

export const PATTERN_TILES: Record<Exclude<PatternId, 'none'>, PatternTile> = {
  dots: { size: 22, marks: [{ d: dot(5.5, 5.5, 2.2) }, { d: dot(16.5, 16.5, 2.2) }] },
  grid: { size: 24, stroke: 1, marks: [{ d: 'M0 0.5H24M0.5 0V24' }] },
  stripes: {
    size: 18,
    stroke: 4,
    marks: [{ d: 'M-4.5 4.5L4.5 -4.5M0 18L18 0M13.5 22.5L22.5 13.5' }],
    flow: { x: 18, y: 0, seconds: 3 },
  },
  waves: {
    size: 36,
    stroke: 2.2,
    marks: [{ d: 'M0 9Q9 3 18 9T36 9' }, { d: 'M0 27Q9 21 18 27T36 27' }],
    flow: { x: 36, y: 0, seconds: 4 },
  },
  hearts: {
    size: 44,
    marks: [
      { d: HEART_PATH, x: 4, y: 4, scale: 0.55 },
      { d: HEART_PATH, x: 26, y: 26, scale: 0.4, rotate: -12 },
    ],
    flow: { x: 0, y: -44, seconds: 6 },
  },
  stars: {
    size: 48,
    marks: [
      { d: STAR_PATH, x: 6, y: 8, scale: 0.5 },
      { d: STAR_PATH, x: 30, y: 30, scale: 0.35, rotate: 18 },
      { d: dot(40, 10, 1.6) },
      { d: dot(14, 38, 1.2) },
    ],
    flow: { x: -48, y: 0, seconds: 10 },
  },
  snow: {
    size: 60,
    marks: [{ d: dot(10, 12, 3) }, { d: dot(38, 6, 2) }, { d: dot(26, 34, 3.6) }, { d: dot(50, 44, 2.4) }, { d: dot(8, 50, 1.8) }],
    flow: { x: 0, y: 60, seconds: 7 },
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
export const PATTERN_ALPHA = 0.16;
