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

/**
 * Pen tools: three kinds of ink, and an eraser that rubs out whatever it
 * passes over (an area, not whole strokes). Eraser passes are strokes too,
 * kept in order, so ink drawn after them isn't erased and undo brings the
 * rubbed-out part back.
 */
export type PenTool = 'pen' | 'highlighter' | 'neon' | 'eraser';
export type InkTool = Exclude<PenTool, 'eraser'>;
export type PenWidth = 'thin' | 'medium' | 'thick';

/**
 * Ink colour: a token name (the three base colours, so the theme's main
 * colour follows the theme) or a '#rrggbb' picked from the palette.
 */
export type InkColor = string;

export interface Stroke {
  tool: PenTool;
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

/** The eraser is wider than the pen at the same setting (fingers are blunt). */
export const ERASER_SCALE = 2.5;

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

// ----- Colour codes for the palette -----

/** '#abc', 'abcdef', ' #ABCDEF ' → '#abcdef'; anything else → null. */
export function normalizeHex(input: string): string | null {
  const v = input.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`;
  if (/^[0-9a-f]{3}$/.test(v)) return `#${[...v].map((c) => c + c).join('')}`;
  return null;
}

/**
 * The colour wheel is HSV: hue around the circle, saturation from the white
 * centre out to the rim, value from the brightness slider. Hue in degrees,
 * saturation and value 0..1 → '#rrggbb'.
 */
export function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(5))}${to(f(3))}${to(f(1))}`;
}

/** '#rrggbb' → hue (degrees), saturation and value (0..1), to put the wheel's marker back. */
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}
