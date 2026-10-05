/** Bottom-bar tabs, one round button each. */
export type AppTab = 'calendar' | 'pins';

/**
 * What a bottom-bar tap does. Every button switches to its screen. Tapped
 * again on its own screen, the pin button drops a pin (so the quick-drop
 * keeps its one-tap reach) and the calendar button flips TODAY ↔ month.
 */
export function bottomBarAction(target: AppTab, current: AppTab): 'switch' | 'pin' | 'calendar' | 'none' {
  if (target !== current) return 'switch';
  if (target === 'pins') return 'pin';
  if (target === 'calendar') return 'calendar';
  return 'none';
}

/**
 * The calendar button tapped again on the calendar: a day screen zooms out
 * to the month, and the month goes back to TODAY. (공유 lives on the day's
 * 꾸미기 rail.)
 */
export function calendarAgain(mode: 'day' | 'month'): 'today' | 'month' {
  return mode === 'month' ? 'today' : 'month';
}

/** Titles of the tabs that are their own full screens (not a sheet over the map). */
export const PAGE_TITLES: Partial<Record<AppTab, string>> = { calendar: '달력' };

/**
 * 달력 is a separate screen, like Instagram's or KakaoTalk's tabs; only
 * 핀 is the map. A tab page steps aside while the map itself is
 * needed: a search, or a place being added.
 */
export function showsPage(tab: AppTab, mapNeeded: boolean): boolean {
  return tab in PAGE_TITLES && !mapNeeded;
}

/**
 * Pages slide off toward the side their button sits on to uncover the map:
 * 달력 (left button) goes left on a right-to-left swipe. -1 = left,
 * 1 = right, 0 = no swipe.
 */
export function homeSwipeDirection(tab: AppTab): -1 | 0 | 1 {
  if (tab === 'calendar') return -1;
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
 * Where an opened link lands: where that kind of thing lives.
 */
export function tabForIncoming(kind: IncomingKind): AppTab {
  if (kind === 'day') return 'calendar';
  return 'pins';
}
