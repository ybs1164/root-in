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

/**
 * Pages slide off toward the side their button sits on to uncover the map:
 * 달력 (left button) goes left on a right-to-left swipe, 추천 (right button)
 * goes right on a left-to-right one. -1 = left, 1 = right, 0 = no swipe.
 */
export function homeSwipeDirection(tab: AppTab): -1 | 0 | 1 {
  if (tab === 'calendar') return -1;
  if (tab === 'influencer') return 1;
  return 0;
}

export const SWIPE = {
  /** Horizontal travel before a touch counts as a swipe rather than a tap or scroll. */
  startPx: 12,
  /** Released past this share of the width, the page goes. */
  distance: 0.3,
  /** …or flicked at least this fast (px/ms) the right way. */
  flick: 0.5,
  flickMinPx: 30,
} as const;

/** Whether a finished swipe (signed dx in px, velocity in px/ms) should uncover the map. */
export function swipeCommits(dir: -1 | 1, dx: number, width: number, velocity: number): boolean {
  const along = dx * dir;
  if (along >= width * SWIPE.distance) return true;
  return along >= SWIPE.flickMinPx && velocity * dir >= SWIPE.flick;
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
