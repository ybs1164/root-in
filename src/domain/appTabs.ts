/** Bottom-bar tabs, one round button each. */
export type AppTab = 'calendar' | 'pins' | 'influencer';

/**
 * What a bottom-bar tap does. Every button switches to its screen; the pin
 * button, once its screen is already showing, doubles as "drop a pin" so the
 * quick-drop action keeps its one-tap reach.
 */
export function bottomBarAction(target: AppTab, current: AppTab): 'switch' | 'pin' | 'none' {
  if (target !== current) return 'switch';
  return target === 'pins' ? 'pin' : 'none';
}

export type IncomingKind = 'course' | 'day' | 'pins';

/**
 * Where an opened link lands. A course opened from the 추천 tab stays
 * there (closing it returns to the feed); links from outside land where
 * that kind of thing lives.
 */
export function tabForIncoming(kind: IncomingKind, current: AppTab): AppTab {
  if (kind === 'day') return 'calendar';
  if (current === 'influencer') return 'influencer';
  return 'pins';
}
