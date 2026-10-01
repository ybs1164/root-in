/**
 * The round buttons under ⚙ on the pin screen: 핀 and 경로. Tapping one
 * opens it (it turns the accent colour and the other button steps aside);
 * tapping it again closes it and both are back.
 */
export type PinRailMode = 'menu' | 'pins' | 'route';

export type PinRailEntry = 'pins' | 'route';

export function pinRailNext(mode: PinRailMode, tapped: PinRailEntry): PinRailMode {
  if (mode === tapped) return 'menu';
  // The other entry is hidden while one is open, so only the menu opens one.
  return mode === 'menu' ? tapped : mode;
}

/** Taps a category in or out of the picked set. */
export function togglePicked(picked: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(picked);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
