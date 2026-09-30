/**
 * Decorations on a calendar day: stickers and pen strokes on the ping
 * drawing, plus the app-wide colour theme. Positions are fractions of the
 * drawing box (0..1), so they survive any screen size and the share image.
 */

export type DecorTool = 'sticker' | 'pen' | 'theme';

export interface PlacedSticker {
  id: string;
  emoji: string;
  x: number;
  y: number;
  /** Width of the sticker as a fraction of the box. */
  size: number;
}

/** Pen tools: three kinds of ink, and an eraser that lifts whole strokes. */
export type PenTool = 'pen' | 'highlighter' | 'neon' | 'eraser';
export type InkTool = Exclude<PenTool, 'eraser'>;
export type PenWidth = 'thin' | 'medium' | 'thick';

/**
 * Ink colour: a token name (the three base colours, so the theme's main
 * colour follows the theme) or a '#rrggbb' picked from the palette.
 */
export type InkColor = string;

export interface Stroke {
  tool: InkTool;
  color: InkColor;
  width: PenWidth;
  points: [number, number][];
}

export interface PenSettings {
  tool: PenTool;
  color: InkColor;
  width: PenWidth;
}

export interface DayDecor {
  stickers: PlacedSticker[];
  strokes: Stroke[];
}

export const EMPTY_DECOR: DayDecor = { stickers: [], strokes: [] };

export const STICKERS = [
  '❤️', '⭐', '✨', '🌸', '🍀', '☀️', '🌙', '🌈', '☕', '🍰', '🍜', '🍦',
  '🍺', '📷', '🎈', '🎁', '🎵', '🐶', '🐱', '🚲', '🌊', '⛰️', '👍', '😊',
];

export const PEN_TOOLS: { tool: PenTool; label: string }[] = [
  { tool: 'pen', label: '일반펜' },
  { tool: 'highlighter', label: '형광펜' },
  { tool: 'neon', label: '네온펜' },
  { tool: 'eraser', label: '지우개' },
];

/** Always-there colours; anything else comes from the palette. */
export const BASE_COLORS: { color: InkColor; label: string }[] = [
  { color: 'ink-black', label: '검정' },
  { color: 'ink-white', label: '흰색' },
  { color: 'accent', label: '테마 색' },
];

export const DEFAULT_PEN: PenSettings = { tool: 'pen', color: 'ink-black', width: 'medium' };

export const isCustomColor = (color: InkColor): boolean => /^#[0-9a-f]{6}$/i.test(color);

/** CSS for an ink colour: tokens by variable, palette picks as they are. */
export const inkCss = (color: InkColor): string => (isCustomColor(color) ? color : `var(--${color})`);

/** Stroke widths as fractions of the box width (~3 / 5 / 10px on a phone). */
export const PEN_WIDTHS: Record<PenWidth, number> = { thin: 0.009, medium: 0.016, thick: 0.03 };

export const STICKER_SIZE = 0.13;

/**
 * The eraser lifts every stroke that passes within `radius` (box fractions)
 * of the point: whole strokes, the way a stroke eraser works.
 */
export function eraseAt(strokes: Stroke[], x: number, y: number, radius: number): Stroke[] {
  const near = (s: Stroke) =>
    s.points.some((p, i) => {
      const q = s.points[i + 1] ?? p;
      return distToSegment(x, y, p, q) <= radius;
    });
  const kept = strokes.filter((s) => !near(s));
  return kept.length === strokes.length ? strokes : kept;
}

function distToSegment(x: number, y: number, [ax, ay]: [number, number], [bx, by]: [number, number]): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Adds a point to a stroke unless it's closer than `minStep` (box fractions)
 * to the last one: fingers report many tiny moves, and dropping them keeps
 * strokes light without changing how they look.
 */
export function extendStroke(points: [number, number][], x: number, y: number, minStep = 0.004): [number, number][] {
  const p: [number, number] = [clamp01(x), clamp01(y)];
  const last = points[points.length - 1];
  if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < minStep) return points;
  return [...points, p];
}

/** Colour themes for the whole app (tokens in styles.css under :root[data-theme=…]). */
export type ThemeId = 'default' | 'night' | 'mint' | 'lavender' | 'sky' | 'mono';

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'default', label: '기본' },
  { id: 'night', label: '밤' },
  { id: 'mint', label: '민트' },
  { id: 'lavender', label: '라벤더' },
  { id: 'sky', label: '하늘' },
  { id: 'mono', label: '모노' },
];

export const isThemeId = (value: unknown): value is ThemeId => THEMES.some((t) => t.id === value);
