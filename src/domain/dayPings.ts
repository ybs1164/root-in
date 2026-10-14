import { addDays } from './calendar';
import { dateKey, timeKey } from './diary';
import { haversineMeters } from './geo';

/** One place visited on a day, as drawn on the calendar's day screen. */
export interface DayPing {
  /** The stored ping (absent on a route's stops, drawn the same way on a card). */
  id?: string;
  /** The pin it was added from: its icon is what the 투명 look shows. */
  pinId?: string;
  name: string;
  /** 'HH:MM' */
  time: string;
  center: [number, number];
}

/**
 * A ping as stored: one of your pins you were at, added to that day's TODAY
 * (a snapshot — deleting or renaming the pin leaves the day as it was).
 * `local` pings were at a 제외 주소 and never leave the phone.
 */
export interface StoredPing {
  id: string;
  /** The pin it was recorded from: that pin isn't offered again the same day. */
  pinId?: string;
  /** The day screen it belongs to (local date, `dateKey`). */
  day: string;
  /** When it was pinned (ISO). */
  at: string;
  name: string;
  center: [number, number];
  address?: string;
  local?: boolean;
}

/** Pins this close to where you are can be added to TODAY (the 후보군). */
export const TODAY_PING_RADIUS_M = 50;

export interface MyLocation {
  center: [number, number];
  /** When the position was fixed (ms). */
  at: number;
}

/**
 * TODAY's 후보군: your pins within 50m of where you are that aren't in today
 * yet (one already recorded today isn't offered again), nearest first.
 */
export function todayCandidates<P extends { id: string; place: { center: [number, number] } }>(
  pins: readonly P[],
  here: [number, number] | null,
  today: readonly StoredPing[],
): P[] {
  if (!here) return [];
  const taken = new Set(today.map((p) => p.pinId).filter(Boolean));
  return pins
    .map((pin) => ({ pin, m: haversineMeters(pin.place.center, here) }))
    .filter(({ pin, m }) => m <= TODAY_PING_RADIUS_M && !taken.has(pin.id))
    .sort((a, b) => a.m - b.m)
    .map(({ pin }) => pin);
}

export const toDayPing = (ping: StoredPing): DayPing => ({
  id: ping.id,
  ...(ping.pinId ? { pinId: ping.pinId } : {}),
  name: ping.name,
  time: timeKey(new Date(ping.at)),
  center: ping.center,
});

/** A date's pings, in the order they were made. */
export function pingsForDate(key: string, stored: readonly StoredPing[]): DayPing[] {
  return stored
    .filter((p) => p.day === key)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
    .map(toDayPing);
}

/** How many pings each date has (the month calendar's dots). */
export function pingCounts(stored: readonly StoredPing[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of stored) counts.set(p.day, (counts.get(p.day) ?? 0) + 1);
  return counts;
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

/**
 * What a day's ping or line can be set to: a shape / line style, or 투명
 * (the picker's empty first slot, as on a route) — no shape, the place's own
 * pin icon instead; no line at all (still tappable to change it back).
 */
export type PingLook = PingShape | 'transparent';
export type LineLook = EdgeStyle | 'transparent';

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
 * takes 450ms) and the lines drawing in (from 350ms, 700ms with `ease`, as in
 * styles.css). The day's decorations settle in right after this.
 */
export const pingsLandedMs = (count: number): number =>
  count === 0 ? 0 : Math.max(count > 1 ? LINES_DRAWN_MS : 0, 120 + (count - 1) * 110 + 450);

/**
 * The lines look drawn at 80% of their 700ms: `ease` has covered ~97% of
 * the way by then and only creeps after, so waiting for the very end left a
 * pause before the stickers came.
 */
const LINES_DRAWN_MS = 350 + 0.8 * 700;
