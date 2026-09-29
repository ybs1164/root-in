/** Bottom-bar tabs. The center pin button is an action, not a tab. */
export type AppTab = 'calendar' | 'pins' | 'influencer';

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
