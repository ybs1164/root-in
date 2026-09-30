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

/** Titles of the tabs that are their own full screens (not a sheet over the map). */
export const PAGE_TITLES: Partial<Record<AppTab, string>> = { calendar: '달력', influencer: '추천' };

/**
 * 달력 and 추천 are separate screens, like Instagram's or KakaoTalk's tabs;
 * only 핀 is the map. A tab page steps aside while the map itself is
 * needed: an opened course or pin set, a search, or a place being added.
 */
export function showsPage(tab: AppTab, mapNeeded: boolean): boolean {
  return tab in PAGE_TITLES && !mapNeeded;
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
