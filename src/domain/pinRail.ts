/**
 * The round buttons under ⚙ on the pin screen: 핀 and 경로. Tapping one
 * opens it (it turns the accent colour); tapping it again closes it. 핀
 * opens its category list between the two (경로 moves down below it); 경로
 * leaves 핀 where it is, and tapping 핀 there switches over.
 */
export type PinRailMode = 'menu' | 'pins' | 'route';

export type PinRailEntry = 'pins' | 'route';

export function pinRailNext(mode: PinRailMode, tapped: PinRailEntry): PinRailMode {
  return mode === tapped ? 'menu' : tapped;
}

/**
 * ALL, the first button in 핀's list: on whenever no (existing) category is
 * picked — every pin shows. It and the categories are never on together:
 * picking one turns ALL off, dropping the last turns it back on.
 */
export function isAllPicked(picked: ReadonlySet<string>, categoryIds: readonly string[]): boolean {
  return !categoryIds.some((id) => picked.has(id));
}

/**
 * ALL tapped: while it is on (every pin showing), a tap hides every pin and
 * turns it off; the next tap — or any tap while categories are picked —
 * brings every pin back with ALL on.
 */
export function tapAll(hidden: boolean, picked: ReadonlySet<string>, categoryIds: readonly string[]): { picked: Set<string>; hidden: boolean } {
  return { picked: new Set(), hidden: !hidden && isAllPicked(picked, categoryIds) };
}

/** Taps a category in or out of the picked set. */
export function togglePicked(picked: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(picked);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** How many category buttons 핀's list shows at once; ↓ brings the next set. */
export const RAIL_PAGE_SIZE = 5;

/** Sets of RAIL_PAGE_SIZE (the last one may be shorter); at least one, even empty. */
export function railPageCount(total: number, size = RAIL_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/** The categories on `page` (taken modulo the page count, so ↓ past the last set wraps to the first). */
export function railPage<T>(items: readonly T[], page: number, size = RAIL_PAGE_SIZE): T[] {
  const count = railPageCount(items.length, size);
  const p = ((page % count) + count) % count;
  return items.slice(p * size, p * size + size);
}
