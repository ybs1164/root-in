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

/** "TODAY" for today, otherwise "DAY 29". */
export function dayTitle(key: string, today: string = dateKey()): string {
  return key === today ? 'TODAY' : `DAY ${Number(key.slice(8, 10))}`;
}

/**
 * Places pings inside a unit square (0..1, y down) keeping their real
 * relative positions, so the drawing reads like a tiny map without one.
 * Longitude is scaled by cos(latitude) so east-west distances aren't stretched.
 */
export function layoutPings(centers: [number, number][], margin = 0.18): { x: number; y: number }[] {
  if (centers.length === 0) return [];
  const midLat = centers.reduce((sum, [, lat]) => sum + lat, 0) / centers.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = centers.map(([lng]) => lng * kx);
  const ys = centers.map(([, lat]) => -lat);
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

/**
 * Pinch thresholds for the calendar zoom. Pinching the day screen in
 * (scale < 1) goes out to the month; pinching the month out (scale > 1)
 * goes into the day under the fingers.
 */
export const PINCH = {
  /** Past this the switch happens while the fingers are still moving. */
  outCommit: 0.55,
  inCommit: 2,
  /** On release, anything past these switches; less snaps back. */
  outRelease: 0.8,
  inRelease: 1.3,
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
