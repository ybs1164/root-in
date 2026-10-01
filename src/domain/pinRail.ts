/**
 * The round buttons under ⚙ on the pin screen. A fold button always sits
 * on top; under it either the two entries (핀 · 경로), the category list
 * that 핀 opens, the (still empty) 경로 view, or nothing when folded.
 */
export type PinRailMode = 'folded' | 'menu' | 'pins' | 'route';

export type PinRailAction = 'fold' | 'pins' | 'route' | 'back';

export function pinRailNext(mode: PinRailMode, action: PinRailAction): PinRailMode {
  switch (action) {
    // From an opened entry the fold button steps back to the entries;
    // only from the entries does it actually fold them away.
    case 'fold':
      return mode === 'menu' ? 'folded' : 'menu';
    case 'back':
      return mode === 'folded' ? 'folded' : 'menu';
    case 'pins':
    case 'route':
      return mode === 'menu' ? action : mode;
  }
}

/** Taps a category in or out of the picked set. */
export function togglePicked(picked: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(picked);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
