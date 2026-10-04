import type { DayDecor } from '../domain/decor';
import { dayDecorKey, isDecorKey } from '../domain/shareSubject';
import { compactDecor, isBlankDecor, loadDays, readDecor } from './dayRepository';

/**
 * 꾸미기 on share cards: stickers, pen strokes, text boxes, theme and
 * background pattern, per card (`day:<date>` or `route:<course id>`), so a
 * card opened again looks the way it was left.
 */
const KEY = 'goodroot:decor:v1';

export type DecorStore = Record<string, DayDecor>;

/** Before v1 a day's decorations were kept with the day (goodroot:days:v1). */
function fromDays(): DecorStore {
  const out: DecorStore = {};
  for (const [date, d] of Object.entries(loadDays().decor)) out[dayDecorKey(date)] = d;
  return out;
}

export function loadDecor(): DecorStore {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return fromDays();
    const parsed = JSON.parse(raw) as unknown;
    const out: DecorStore = {};
    if (parsed && typeof parsed === 'object') {
      for (const [key, v] of Object.entries(parsed)) {
        const d = isDecorKey(key) ? readDecor(v) : null;
        if (d) out[key] = d;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveDecor(store: DecorStore): void {
  const out: DecorStore = {};
  for (const [key, d] of Object.entries(store)) if (!isBlankDecor(d)) out[key] = compactDecor(d);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(out));
  } catch {
    // Storage full or off: the card keeps its decorations until reload.
  }
}
