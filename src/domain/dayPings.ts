import { addDays } from './calendar';
import { dateKey } from './diary';

/** One place visited on a day, as drawn on the calendar's day screen. */
export interface DayPing {
  name: string;
  /** 'HH:MM' */
  time: string;
  center: [number, number];
}

/**
 * Temporary test data: pings aren't recorded yet (they will come from the
 * current location), so two fixed dates carry sample places to exercise the
 * screen. Fixed, not "today" and "yesterday": a day's places belong to that
 * date and stay there as days pass, and TODAY moves on to a fresh day.
 * Remove once real pings are stored.
 */
export const SAMPLE_TODAY_PINGS: DayPing[] = [
  { name: '성수연방', time: '10:30', center: [127.056, 37.5475] },
  { name: '서울숲', time: '13:00', center: [127.0374, 37.5444] },
  { name: '뚝섬한강공원', time: '17:40', center: [127.067, 37.529] },
];

/** Temporary test data for the day before, so paging back a day has something to show. */
export const SAMPLE_YESTERDAY_PINGS: DayPing[] = [
  { name: '익선동 한옥거리', time: '11:00', center: [126.9895, 37.574] },
  { name: '창덕궁', time: '13:20', center: [126.991, 37.5794] },
  { name: '인사동', time: '16:00', center: [126.9853, 37.5718] },
  { name: '을지로 노가리골목', time: '19:10', center: [126.9912, 37.566] },
];

/** Where the sample pings live (see above). */
/**
 * Temporary test data for whatever day it is when the app opens, so TODAY
 * itself has something to draw and decorate (an 을지로·명동·남산 walk).
 * Remove with the rest once real pings are stored.
 */
export const SAMPLE_NOW_PINGS: DayPing[] = [
  { name: '을지로 노가리 골목', time: '12:10', center: [126.9911, 37.5662] },
  { name: '명동성당', time: '14:30', center: [126.9873, 37.5633] },
  { name: '남산서울타워', time: '18:20', center: [126.9882, 37.5512] },
];

export const SAMPLE_PING_DATES: Record<string, DayPing[]> = {
  [dateKey()]: SAMPLE_NOW_PINGS,
  '2026-09-30': SAMPLE_TODAY_PINGS,
  '2026-09-29': SAMPLE_YESTERDAY_PINGS,
};

/** A date's pings: its own, whatever today is. */
export function pingsForDate(key: string): DayPing[] {
  return SAMPLE_PING_DATES[key] ?? [];
}

/**
 * Sideways swipe on a day screen. Left-to-right (dx > 0) always pages to
 * the day before. Right-to-left pages to the next day, except on TODAY,
 * where it isn't the calendar's: the page slides off to the map instead.
 */
export function daySwipeTarget(date: string, today: string, dx: number): string | null {
  if (dx > 0) return addDays(date, -1);
  if (dx < 0 && date !== today) return addDays(date, 1);
  return null;
}

/** The most recent ping (latest time; the later one on ties), drawn bigger. */
export function latestPingIndex(pings: DayPing[]): number {
  return pings.reduce((best, ping, i) => (best < 0 || ping.time >= pings[best].time ? i : best), -1);
}

/** "TODAY" for today, otherwise "DAY 29". */
export function dayTitle(key: string, today: string = dateKey()): string {
  return key === today ? 'TODAY' : `DAY ${Number(key.slice(8, 10))}`;
}

/**
 * Places pings inside a unit square (0..1, y down) so they spread over the
 * whole drawing. Each axis is stretched to the margins on its own: the
 * drawing keeps which place is east/west and north/south of which, but
 * not true distances, so a day around one neighbourhood doesn't bunch up
 * in a corner. Longitude is scaled by cos(latitude) before comparing.
 */
export function layoutPings(centers: [number, number][], margin = 0.18): { x: number; y: number }[] {
  if (centers.length === 0) return [];
  const midLat = centers.reduce((sum, [, lat]) => sum + lat, 0) / centers.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const spread = (values: number[]) => {
    const [min, max] = [Math.min(...values), Math.max(...values)];
    // All on one line along this axis: keep them on the middle of it.
    return values.map((v) => (max === min ? 0.5 : margin + ((v - min) / (max - min)) * (1 - margin * 2)));
  };
  const xs = spread(centers.map(([lng]) => lng * kx));
  const ys = spread(centers.map(([, lat]) => -lat));
  return xs.map((x, i) => ({ x, y: ys[i] }));
}

/** Shapes a ping can take (long-press to choose). */
export type PingShape = 'pin' | 'dot' | 'star' | 'heart';

export const PING_SHAPES: { shape: PingShape; label: string }[] = [
  { shape: 'pin', label: '핀' },
  { shape: 'dot', label: '점' },
  { shape: 'star', label: '별' },
  { shape: 'heart', label: '하트' },
];

/** Line styles for the segment between two consecutive pings (long-press a line). */
export type EdgeStyle = 'solid' | 'dashed' | 'dotted' | 'bold';

export const EDGE_STYLES: { style: EdgeStyle; label: string }[] = [
  { style: 'solid', label: '실선' },
  { style: 'dashed', label: '파선' },
  { style: 'dotted', label: '점선' },
  { style: 'bold', label: '굵은 선' },
];

/** Stable key for a ping's per-ping settings (its shape, for now). */
export const pingKey = (date: string, ping: DayPing): string => `${date}|${ping.time}|${ping.name}`;

/** Key for the segment from one ping to the next; follows the pings, not their order in a list. */
export const edgeKey = (date: string, from: DayPing, to: DayPing): string =>
  `${pingKey(date, from)}>${to.time}|${to.name}`;

/**
 * Press on a ping: held this long without drifting is a long press (shape
 * picker); released sooner is a tap. Moving further than `slopPx` is neither.
 */
export const PRESS = { longMs: 500, slopPx: 10 } as const;

export function classifyPress(heldMs: number, movedPx: number): 'tap' | 'long' | 'none' {
  if (movedPx > PRESS.slopPx) return 'none';
  return heldMs >= PRESS.longMs ? 'long' : 'tap';
}

/**
 * Pinch thresholds for the calendar zoom. Pinching the day screen in
 * (scale < 1) goes out to the month; pinching the month out (scale > 1)
 * goes into the day under the fingers.
 */
export const PINCH = {
  /** Past this the switch happens while the fingers are still moving. */
  outCommit: 0.7,
  inCommit: 1.5,
  /** On release (or a held pause), anything past these switches; less snaps back. */
  outRelease: 0.9,
  inRelease: 1.12,
  /** Fingers held still this long past a release threshold finish the zoom on their own. */
  stallMs: 220,
} as const;

/** 0 → 1 as a pinch travels from untouched to its commit point. */
export function pinchProgress(scale: number): number {
  if (scale < 1) return Math.min(1, (1 - scale) / (1 - PINCH.outCommit));
  return Math.min(1, (scale - 1) / (PINCH.inCommit - 1));
}

export type PinchResult = 'switch' | 'stay';

export function pinchOutcome(scale: number, released: boolean): PinchResult {
  if (scale < 1) return scale <= (released ? PINCH.outRelease : PINCH.outCommit) ? 'switch' : 'stay';
  return scale >= (released ? PINCH.inRelease : PINCH.inCommit) ? 'switch' : 'stay';
}

/**
 * When a day's drawing has finished arriving, in ms after it mounts: the
 * last pin's drop (each starts 110ms after the one before, from 120ms, and
 * takes 450ms) and the lines drawing in (350ms + 700ms), as in styles.css.
 * The day's decorations settle in after this.
 */
export const pingsLandedMs = (count: number): number =>
  count === 0 ? 0 : Math.max(count > 1 ? 1050 : 0, 120 + (count - 1) * 110 + 450);
