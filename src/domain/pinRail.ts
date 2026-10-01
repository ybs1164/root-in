/**
 * The round buttons under ⚙ on the pin screen: 핀 and 경로. Tapping one
 * opens it (it turns the accent colour); tapping it again closes it. 핀
 * puts 경로 away for its category list; 경로 leaves 핀 where it is, and
 * tapping 핀 there switches over.
 */
export type PinRailMode = 'menu' | 'pins' | 'route';

export type PinRailEntry = 'pins' | 'route';

export function pinRailNext(mode: PinRailMode, tapped: PinRailEntry): PinRailMode {
  return mode === tapped ? 'menu' : tapped;
}

/** Taps a category in or out of the picked set. */
export function togglePicked(picked: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(picked);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
