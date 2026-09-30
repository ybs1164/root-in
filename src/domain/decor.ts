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

/** Pen colours are token names, so strokes follow the theme (and dark mode). */
export type PenColor = 'text' | 'accent' | 'sky' | 'sage' | 'amber' | 'pin-5' | 'pin-3';
export type PenWidth = 'thin' | 'medium' | 'thick';

export interface Stroke {
  color: PenColor;
  width: PenWidth;
  points: [number, number][];
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

export const PEN_COLORS: { color: PenColor; label: string }[] = [
  { color: 'text', label: '검정' },
  { color: 'accent', label: '포인트' },
  { color: 'sky', label: '파랑' },
  { color: 'sage', label: '초록' },
  { color: 'amber', label: '노랑' },
  { color: 'pin-5', label: '분홍' },
  { color: 'pin-3', label: '보라' },
];

/** Stroke widths as fractions of the box width (~3 / 5 / 10px on a phone). */
export const PEN_WIDTHS: Record<PenWidth, number> = { thin: 0.009, medium: 0.016, thick: 0.03 };

export const STICKER_SIZE = 0.13;

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
