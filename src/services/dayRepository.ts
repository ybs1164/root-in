import {
  BASE_COLORS,
  clamp01,
  isCustomColor,
  isPatternId,
  isThemeId,
  PEN_TOOLS,
  PEN_WIDTHS,
  STICKER_MAX,
  STICKER_MIN,
  cleanTextStyle,
  isBlankText,
  TEXT_ALIGNS,
  TEXT_FONTS,
  TEXT_MAX,
  TEXT_MAX_LENGTH,
  TEXT_MIN,
  type DayDecor,
  type PenWidth,
  type PlacedSticker,
  type PlacedText,
  type Stroke,
} from '../domain/decor';
import type { EdgeStyle, PingShape } from '../domain/dayPings';

/**
 * What a calendar day has been made into, kept per date so any day opened
 * later looks the way it was left: the shapes and line styles chosen for its
 * pings. (Its stickers, strokes, text, theme and pattern used to live here
 * too; they belong to the share card now, in decorRepository, which takes
 * them over once and leaves `decor` here as it was.)
 */
const DAYS_KEY = 'goodroot:days:v1';

export interface DayStore {
  decor: Record<string, DayDecor>;
  /** By `pingKey` (date|time|name). */
  shapes: Record<string, PingShape>;
  /** By `edgeKey`. */
  edges: Record<string, EdgeStyle>;
}

export const EMPTY_DAY_STORE: DayStore = { decor: {}, shapes: {}, edges: {} };

const SHAPES: PingShape[] = ['pin', 'dot', 'star', 'heart'];
const EDGES: EdgeStyle[] = ['solid', 'dashed', 'dotted', 'bold'];
const MAX_STROKES = 400;
const MAX_POINTS = 1500;
const MAX_STICKERS = 80;
const MAX_TEXTS = 60;

const isDate = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isColor = (c: unknown): c is string =>
  typeof c === 'string' && (isCustomColor(c) || BASE_COLORS.some((b) => b.color === c));

function readStroke(v: unknown): Stroke | null {
  const s = v as Stroke;
  if (!s || !PEN_TOOLS.some((t) => t.tool === s.tool) || !isColor(s.color) || !(s.width in PEN_WIDTHS)) return null;
  if (!Array.isArray(s.points)) return null;
  const points = s.points
    .filter((p): p is [number, number] => Array.isArray(p) && num(p[0]) && num(p[1]))
    .slice(0, MAX_POINTS)
    .map(([x, y]) => [clamp01(x), clamp01(y)] as [number, number]);
  return points.length ? { tool: s.tool, color: s.color, width: s.width as PenWidth, points } : null;
}

function readSticker(v: unknown): PlacedSticker | null {
  const s = v as PlacedSticker;
  if (!s || typeof s.id !== 'string' || typeof s.emoji !== 'string' || s.emoji.length > 16) return null;
  if (!num(s.x) || !num(s.y) || !num(s.size)) return null;
  return {
    id: s.id.slice(0, 64),
    emoji: s.emoji,
    x: clamp01(s.x),
    y: clamp01(s.y),
    size: Math.min(STICKER_MAX, Math.max(STICKER_MIN, s.size)),
    ...(num(s.rotate) ? { rotate: s.rotate } : {}),
  };
}

function readText(v: unknown): PlacedText | null {
  const t = v as PlacedText;
  if (!t || typeof t.id !== 'string' || typeof t.text !== 'string' || isBlankText(t.text)) return null;
  if (!num(t.x) || !num(t.y) || !num(t.size)) return null;
  const style = cleanTextStyle({
    font: TEXT_FONTS.some((f) => f.font === t.font) ? t.font : 'sans',
    color: isColor(t.color) ? t.color : 'ink-black',
    align: TEXT_ALIGNS.some((a) => a.align === t.align) ? t.align : 'center',
    bold: t.bold === true,
    italic: t.italic === true,
    underline: t.underline === true,
    strike: t.strike === true,
  });
  return {
    id: t.id.slice(0, 64),
    text: t.text.slice(0, TEXT_MAX_LENGTH),
    x: clamp01(t.x),
    y: clamp01(t.y),
    size: Math.min(TEXT_MAX, Math.max(TEXT_MIN, t.size)),
    ...(num(t.rotate) ? { rotate: t.rotate } : {}),
    ...style,
  };
}

export function readDecor(v: unknown): DayDecor | null {
  const d = v as DayDecor;
  if (!d || typeof d !== 'object') return null;
  const strokes = (Array.isArray(d.strokes) ? d.strokes : []).map(readStroke).filter((s): s is Stroke => !!s).slice(-MAX_STROKES);
  const stickers = (Array.isArray(d.stickers) ? d.stickers : [])
    .map(readSticker)
    .filter((s): s is PlacedSticker => !!s)
    .slice(-MAX_STICKERS);
  const texts = (Array.isArray(d.texts) ? d.texts : [])
    .map(readText)
    .filter((t): t is PlacedText => !!t)
    .slice(-MAX_TEXTS);
  return {
    stickers,
    strokes,
    ...(texts.length ? { texts } : {}),
    ...(isThemeId(d.theme) && d.theme !== 'default' ? { theme: d.theme } : {}),
    ...(isPatternId(d.pattern) && d.pattern !== 'none' ? { pattern: d.pattern } : {}),
  };
}

const pick = <T>(raw: unknown, ok: (v: unknown) => v is T): Record<string, T> => {
  const out: Record<string, T> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) if (isDate(k.slice(0, 10)) && k.length < 300 && ok(v)) out[k] = v;
  }
  return out;
};

export function loadDays(): DayStore {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DAYS_KEY) ?? 'null') as Partial<DayStore> | null;
    if (!raw || typeof raw !== 'object') return EMPTY_DAY_STORE;
    const decor: Record<string, DayDecor> = {};
    for (const [date, v] of Object.entries(raw.decor ?? {})) {
      const d = isDate(date) ? readDecor(v) : null;
      if (d) decor[date] = d;
    }
    return {
      decor,
      shapes: pick(raw.shapes, (v): v is PingShape => SHAPES.includes(v as PingShape)),
      edges: pick(raw.edges, (v): v is EdgeStyle => EDGES.includes(v as EdgeStyle)),
    };
  } catch {
    return EMPTY_DAY_STORE;
  }
}

// Box fractions to 4 places (a tenth of a pixel on a phone): strokes stay
// small in storage without looking any different.
const round = (n: number) => Math.round(n * 1e4) / 1e4;

/** Nothing on it worth a row. */
export const isBlankDecor = (d: DayDecor): boolean =>
  !d.strokes.length && !d.stickers.length && !d.texts?.length && !d.theme && !d.pattern;

/** Strokes rounded for storage. */
export const compactDecor = (d: DayDecor): DayDecor => ({
  ...d,
  strokes: d.strokes.map((s) => ({ ...s, points: s.points.map(([x, y]) => [round(x), round(y)] as [number, number]) })),
});

export function saveDays(store: DayStore): void {
  const decor: Record<string, DayDecor> = {};
  for (const [date, d] of Object.entries(store.decor)) {
    // Days left blank again aren't worth a row.
    if (isBlankDecor(d)) continue;
    decor[date] = compactDecor(d);
  }
  try {
    window.localStorage.setItem(DAYS_KEY, JSON.stringify({ ...store, decor }));
  } catch {
    // Storage full or off: the day still shows its decorations until reload.
  }
}
