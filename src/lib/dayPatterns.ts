import type { PatternId } from '../domain/decor';
import { HEART_PATH, STAR_PATH } from './pingPaths';

/** 💧 in a 24-unit box: a point on top, round at the bottom. */
const DROP_PATH = 'M12 2C12 2 5 10.5 5 15a7 7 0 0 0 14 0C19 10.5 12 2 12 2Z';

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
  /** This mark as an outline at this width, whatever the tile does (a constellation's lines among filled stars). */
  stroke?: number;
  /** This mark's own strength (0..1) on top of the pattern's: where two such marks overlap it shows darker (a gingham check). */
  alpha?: number;
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

/** A 4-point sparkle, in a 24-unit box. */
const SPARKLE_PATH = 'M12 2Q13.6 10.4 22 12Q13.6 13.6 12 22Q10.4 13.6 2 12Q10.4 10.4 12 2Z';
/** A puffy cloud, in a 24-unit box. */
const CLOUD_PATH = 'M6.5 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.3 8.2a5.2 5.2 0 0 1 .9 10.3Z';
/** Five round petals round an open middle, with a small centre dot, in a 24-unit box. */
const FLOWER_PATH = [0, 1, 2, 3, 4]
  .map((i) => {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const cx = 12 + 6.2 * Math.cos(a);
    const cy = 12 + 6.2 * Math.sin(a);
    return `M${(cx - 4.4).toFixed(2)} ${cy.toFixed(2)}a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0`;
  })
  .join('') + 'M10.2 12a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0';

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

/**
 * 밤하늘: a field of tiny stars and a few sparkles, two constellations (thin
 * lines joining their stars), a ringed planet and a crescent moon, all kept
 * inside one 320 tile so nothing is cut at a seam.
 */
function nightSky(): PatternMark[] {
  const size = 320;
  const marks: PatternMark[] = [];
  // A constellation: its stars as dots, the lines between them as a thin outline.
  const constellation = (pts: [number, number][]) => {
    marks.push({ d: pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(''), stroke: 1.4 });
    for (const [x, y] of pts) marks.push({ d: dot(x, y, 2.6) });
  };
  constellation([[36, 52], [62, 40], [90, 58], [118, 46], [132, 76]]);
  constellation([[214, 214], [238, 196], [262, 210], [252, 238], [226, 244]]);
  // A planet with a tilted ring round it.
  marks.push({ d: dot(250, 70, 13) });
  marks.push({ d: 'M-24 0a24 7 0 1 0 48 0a24 7 0 1 0 -48 0', x: 250, y: 70, rotate: -18, stroke: 2.4 });
  // A crescent moon.
  marks.push({ d: 'M0 -16A16 16 0 1 0 0 16A12 13 0 1 1 0 -16Z', x: 76, y: 236, rotate: -20 });
  // Tiny stars and sparkles in the gaps.
  const rnd = seeded(23);
  const taken: { x: number; y: number; r: number }[] = [
    { x: 84, y: 58, r: 56 }, { x: 238, y: 220, r: 36 }, { x: 250, y: 70, r: 30 }, { x: 76, y: 236, r: 22 },
  ];
  const free = (x: number, y: number, r: number) =>
    taken.every((t) => {
      const dx = Math.min(Math.abs(t.x - x), size - Math.abs(t.x - x));
      const dy = Math.min(Math.abs(t.y - y), size - Math.abs(t.y - y));
      return Math.hypot(dx, dy) > t.r + r + 8;
    });
  const place = (count: number, r: [number, number], make: (x: number, y: number, r: number) => PatternMark) => {
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 60; tries++) {
        const rr = r[0] + rnd() * (r[1] - r[0]);
        const x = rr + 2 + rnd() * (size - 2 * rr - 4);
        const y = rr + 2 + rnd() * (size - 2 * rr - 4);
        if (!free(x, y, rr)) continue;
        taken.push({ x, y, r: rr });
        marks.push(make(x, y, rr));
        break;
      }
    }
  };
  place(7, [5, 9], (x, y, r) => ({ d: SPARKLE_PATH, x, y, scale: r / 10, origin: 12 }));
  place(30, [0.9, 1.9], (x, y, r) => ({ d: dot(x, y, r) }));
  return marks;
}

// Spaced out and bold enough to read at a glance on the page, like the
// previews in the 꾸미기 sheet, while staying a backdrop.
export const PATTERN_TILES: Record<Exclude<PatternId, 'none'>, PatternTile> = {
  dots: { size: 44, marks: [{ d: dot(11, 11, 4) }, { d: dot(33, 33, 4) }] },
  // 물방울: big polka dots, staggered.
  polka: { size: 64, marks: [{ d: dot(16, 16, 10) }, { d: dot(48, 48, 10) }] },
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
  // 체크무늬: see-through bands both ways, darker where they cross (gingham).
  check: {
    size: 40,
    marks: [
      { d: 'M0 0H40V16H0Z', alpha: 0.55 },
      { d: 'M0 0H16V40H0Z', alpha: 0.55 },
    ],
  },
  // 체크보드: a chessboard.
  checker: { size: 48, marks: [{ d: 'M0 0H24V24H0ZM24 24H48V48H24Z' }] },
  // 밤하늘: stars, constellations, a planet and the moon, drifting slowly.
  night: { size: 320, marks: nightSky(), flow: { x: -320, y: 0, seconds: 90 } },
  // 구름: puffy clouds drifting sideways.
  clouds: {
    size: 320,
    marks: scatter(17, 320, [{ kind: { path: CLOUD_PATH }, count: 7, r: [16, 28] }]),
    flow: { x: 320, y: 0, seconds: 70 },
  },
  // 꽃: flowers scattered at random sizes and turns.
  flowers: {
    size: 320,
    marks: scatter(29, 320, [{ kind: { path: FLOWER_PATH }, count: 14, r: [8, 15], turn: 36 }]),
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
  // 💧 drops, scattered and drifting down like rain.
  drops: {
    size: 320,
    marks: scatter(5, 320, [{ kind: { path: DROP_PATH }, count: 13, r: [7, 14], turn: 12 }]),
    flow: { x: 0, y: 320, seconds: 26 },
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
  ctx.lineJoin = 'round';
  for (let ty = 0; ty < area.h / unit; ty += tile.size) {
    for (let tx = 0; tx < area.w / unit; tx += tile.size) {
      for (const { m, path } of paths) {
        const stroke = m.stroke ?? tile.stroke;
        ctx.save();
        ctx.globalAlpha = PATTERN_ALPHA * (m.alpha ?? 1);
        ctx.translate(tx + (m.x ?? 0), ty + (m.y ?? 0));
        ctx.rotate(((m.rotate ?? 0) * Math.PI) / 180);
        ctx.scale(m.scale ?? 1, m.scale ?? 1);
        ctx.translate(-(m.origin ?? 0), -(m.origin ?? 0));
        if (stroke) {
          ctx.lineWidth = stroke;
          ctx.stroke(path);
        } else ctx.fill(path);
        ctx.restore();
      }
    }
  }
  if (tile.margin) ctx.fillRect(tile.margin.x, 0, tile.margin.width, area.h / unit);
  ctx.restore();
}

/** How strongly a pattern shows: a backdrop, never competing with the pings. */
export const PATTERN_ALPHA = 0.22;
