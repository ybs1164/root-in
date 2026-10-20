/**
 * The two screens: the map (핀) and the people page (We Now). The calendar
 * page is gone (test build, 2026-10-19): TODAY opens from We Now's TODAY tile.
 */
export type AppTab = 'pins' | 'people';

/** The bottom row's round buttons, one per screen. */
export type BarButton = 'pins' | 'people';

/** Where a button sits in the row: left, the big one in the centre, or right. */
export type BarSlot = 'l' | 'c' | 'r';

/** The slot `button` takes on `tab`'s screen: map = 핑(big) 사람, people = 핑 사람(big). */
export function barSlot(button: BarButton, tab: AppTab): BarSlot {
  if (button === tab) return 'c';
  return tab === 'pins' ? 'r' : 'l';
}

/**
 * Which way the row turns going `from` → `to`: 1 = every button one place
 * right, -1 = left, 0 = no change. With two buttons nothing wraps round.
 */
export function barTurn(from: AppTab, to: AppTab): -1 | 0 | 1 {
  if (from === to) return 0;
  return to === 'people' ? -1 : 1;
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
export const PAGE_TITLES: Partial<Record<AppTab, string>> = { people: 'We Now' };

/**
 * We Now is a separate screen, like Instagram's or KakaoTalk's tabs; only
 * 핀 is the map. A tab page steps aside while the map itself is
 * needed: a search, or a place being added.
 */
export function showsPage(tab: AppTab, mapNeeded: boolean): boolean {
  return tab in PAGE_TITLES && !mapNeeded;
}

/**
 * Where a sideways swipe on a page goes: `left` for a right-to-left swipe
 * (the page slides off to the left), `right` for left-to-right. We Now →
 * 핀(map). The map itself has no swipe.
 */
export function pageSwipes(tab: AppTab): { left: AppTab | null; right: AppTab | null } {
  if (tab === 'people') return { left: null, right: 'pins' };
  return { left: null, right: null };
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
  // TODAY lives on We Now now.
  if (kind === 'day') return 'people';
  return 'pins';
}
