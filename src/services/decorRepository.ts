import { clamp01, type DayDecor } from '../domain/decor';
import { cardToScene, DRAWING_BOX, FRONT_CARD, SCENE } from '../domain/polaroid';
import { isDecorKey } from '../domain/shareSubject';
import { compactDecor, isBlankDecor, readDecor } from './dayRepository';

/**
 * 꾸미기 on share cards: stickers, pen strokes, text boxes, theme and
 * background pattern, per card (`day:<date>` or `route:<course id>`), so a
 * card opened again looks the way it was left. Pieces are in scene
 * fractions (the whole share image, two polaroids and the backdrop). A
 * day's own 꾸미기 stays with the day (goodroot:days:v1) and goes into the
 * card's photo when it's shared.
 */
const KEY = 'goodroot:decor:v2';
/** v1: pieces in the front card's drawing box (a square). */
const V1_KEY = 'goodroot:decor:v1';

export type DecorStore = Record<string, DayDecor>;

/**
 * Moves pieces laid out in the drawing box (v1) to where that box now lies on the scene: on the front card, turned
 * with it. Sizes keep their size on screen; pen widths are fixed steps and
 * stay as they were.
 */
export function boxToScene(d: DayDecor): DayDecor {
  const k = DRAWING_BOX.size / SCENE.w;
  const at = (x: number, y: number): [number, number] => {
    const p = cardToScene(FRONT_CARD, DRAWING_BOX.x + x * DRAWING_BOX.size, DRAWING_BOX.y + y * DRAWING_BOX.size);
    return [clamp01(p.x / SCENE.w), clamp01(p.y / SCENE.h)];
  };
  const turn = (r?: number) => ((r ?? 0) + FRONT_CARD.angle) % 360;
  return {
    ...d,
    strokes: d.strokes.map((s) => ({ ...s, points: s.points.map(([x, y]) => at(x, y)) })),
    stickers: d.stickers.map((s) => {
      const [x, y] = at(s.x, s.y);
      return { ...s, x, y, size: s.size * k, rotate: turn(s.rotate) };
    }),
    ...(d.texts
      ? {
          texts: d.texts.map((t) => {
            const [x, y] = at(t.x, t.y);
            return { ...t, x, y, size: t.size * k, rotate: turn(t.rotate) };
          }),
        }
      : {}),
  };
}

/** Reads a stored map of cards, keeping only well-formed ones. */
function readStore(raw: string): DecorStore {
  const parsed = JSON.parse(raw) as unknown;
  const out: DecorStore = {};
  if (parsed && typeof parsed === 'object') {
    for (const [key, v] of Object.entries(parsed)) {
      const d = isDecorKey(key) ? readDecor(v) : null;
      if (d) out[key] = d;
    }
  }
  return out;
}

/**
 * What came before v2: v1 route cards, in the drawing box. (v1's day cards
 * were copies of the days' own 꾸미기, which the photo shows now.)
 */
function legacy(): DecorStore {
  const v1 = window.localStorage.getItem(V1_KEY);
  const old: DecorStore = v1 === null ? {} : readStore(v1);
  const out: DecorStore = {};
  for (const [key, d] of Object.entries(old)) {
    if (!key.startsWith('route:')) continue;
    // Read back through the checks: moved pieces get the usual limits (sizes) too.
    const moved = readDecor(boxToScene(d));
    if (moved) out[key] = moved;
  }
  return out;
}

export function loadDecor(): DecorStore {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === null ? legacy() : readStore(raw);
  } catch {
    return {};
  }
}

export function saveDecor(store: DecorStore): void {
  const out: DecorStore = {};
  for (const [key, d] of Object.entries(store)) if (!isBlankDecor(d)) out[key] = compactDecor(d);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(out));
    window.localStorage.removeItem(V1_KEY);
  } catch {
    // Storage full or off: the card keeps its decorations until reload.
  }
}
