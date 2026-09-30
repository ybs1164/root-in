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
 * current location), so only today shows these three to exercise the screen.
 * Remove once real pings are stored.
 */
export const SAMPLE_TODAY_PINGS: DayPing[] = [
  { name: '성수연방', time: '10:30', center: [127.056, 37.5475] },
  { name: '서울숲', time: '13:00', center: [127.0374, 37.5444] },
  { name: '뚝섬한강공원', time: '17:40', center: [127.067, 37.529] },
];

export function pingsForDate(key: string, today: string = dateKey()): DayPing[] {
  return key === today ? SAMPLE_TODAY_PINGS : [];
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
 * Places pings inside a unit square (0..1, y down) keeping their real
 * relative positions, so the drawing reads like a tiny map without one.
 * Longitude is scaled by cos(latitude) so east-west distances aren't stretched.
 * With `focus`, that ping (the latest) sits in the middle and the rest are
 * scaled around it to fit; otherwise the whole group is centred.
 */
export function layoutPings(centers: [number, number][], focus = -1, margin = 0.18): { x: number; y: number }[] {
  if (centers.length === 0) return [];
  const midLat = centers.reduce((sum, [, lat]) => sum + lat, 0) / centers.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = centers.map(([lng]) => lng * kx);
  const ys = centers.map(([, lat]) => -lat);

  if (focus >= 0 && focus < centers.length) {
    const room = 0.5 - margin;
    const reach = Math.max(...xs.map((x) => Math.abs(x - xs[focus])), ...ys.map((y) => Math.abs(y - ys[focus])));
    const k = reach === 0 ? 0 : room / reach;
    return xs.map((x, i) => ({ x: 0.5 + (x - xs[focus]) * k, y: 0.5 + (ys[i] - ys[focus]) * k }));
  }

  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY);
  const size = 1 - margin * 2;
  if (span === 0) return centers.map(() => ({ x: 0.5, y: 0.5 }));
  // Centre the smaller axis instead of pinning it to the top-left.
  const offX = (size - ((maxX - minX) / span) * size) / 2;
  const offY = (size - ((maxY - minY) / span) * size) / 2;
  return xs.map((x, i) => ({
    x: margin + offX + ((x - minX) / span) * size,
    y: margin + offY + ((ys[i] - minY) / span) * size,
  }));
}

/** Shapes a ping can take (long-press to choose). */
export type PingShape = 'pin' | 'dot' | 'star' | 'heart';

export const PING_SHAPES: { shape: PingShape; label: string }[] = [
  { shape: 'pin', label: '핀' },
  { shape: 'dot', label: '점' },
  { shape: 'star', label: '별' },
  { shape: 'heart', label: '하트' },
];

/** Stable key for a ping's per-ping settings (its shape, for now). */
export const pingKey = (date: string, ping: DayPing): string => `${date}|${ping.time}|${ping.name}`;

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
