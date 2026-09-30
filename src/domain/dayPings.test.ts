import { describe, expect, it } from 'vitest';
import { classifyPress, dayTitle, latestPingIndex, layoutPings, pingKey, pinchOutcome, pinchProgress, pingsForDate, SAMPLE_TODAY_PINGS } from './dayPings';

describe('calendar day screen', () => {
  it('titles today as TODAY and other days as DAY <n>', () => {
    expect(dayTitle('2026-09-30', '2026-09-30')).toBe('TODAY');
    expect(dayTitle('2026-09-29', '2026-09-30')).toBe('DAY 29');
    expect(dayTitle('2026-10-05', '2026-09-30')).toBe('DAY 5');
  });

  it('only today has (temporary test) pings; other days are empty', () => {
    expect(pingsForDate('2026-09-30', '2026-09-30')).toBe(SAMPLE_TODAY_PINGS);
    expect(SAMPLE_TODAY_PINGS).toHaveLength(3);
    expect(pingsForDate('2026-09-29', '2026-09-30')).toEqual([]);
  });

  it('lays pings out inside the margins, keeping east/west and north/south', () => {
    const points = layoutPings([
      [127.0, 37.5],
      [127.02, 37.5],
      [127.0, 37.51],
    ]);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0.18 - 1e-9);
      expect(p.x).toBeLessThanOrEqual(0.82 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(0.18 - 1e-9);
      expect(p.y).toBeLessThanOrEqual(0.82 + 1e-9);
    }
    expect(points[1].x).toBeGreaterThan(points[0].x); // east is right
    expect(points[2].y).toBeLessThan(points[0].y); // north is up
  });

  it('puts a single ping (or identical ones) in the middle and handles none', () => {
    expect(layoutPings([[127, 37.5]])).toEqual([{ x: 0.5, y: 0.5 }]);
    expect(layoutPings([])).toEqual([]);
  });

  it('pinch in switches to the month, pinch out switches to the day, small pinches snap back', () => {
    expect(pinchOutcome(0.5, false)).toBe('switch');
    expect(pinchOutcome(0.7, false)).toBe('stay');
    expect(pinchOutcome(0.7, true)).toBe('switch');
    expect(pinchOutcome(0.9, true)).toBe('stay');
    expect(pinchOutcome(2.1, false)).toBe('switch');
    expect(pinchOutcome(1.5, true)).toBe('switch');
    expect(pinchOutcome(1.1, true)).toBe('stay');
    expect(pinchProgress(1)).toBe(0);
    expect(pinchProgress(0.55)).toBe(1);
    expect(pinchProgress(1.5)).toBeCloseTo(0.5);
  });

  it('picks the latest ping by time, whatever the list order', () => {
    const at = (time: string) => ({ name: time, time, center: [127, 37.5] as [number, number] });
    expect(latestPingIndex([at('10:30'), at('17:40'), at('13:00')])).toBe(1);
    expect(latestPingIndex(SAMPLE_TODAY_PINGS)).toBe(2);
    expect(latestPingIndex([])).toBe(-1);
  });

  it('with a focus ping (the latest), puts it in the middle and keeps the rest inside the margins', () => {
    const centers: [number, number][] = SAMPLE_TODAY_PINGS.map((p) => p.center);
    const points = layoutPings(centers, 2);
    expect(points[2]).toEqual({ x: 0.5, y: 0.5 });
    for (const p of points) {
      for (const v of [p.x, p.y]) {
        expect(v).toBeGreaterThanOrEqual(0.18 - 1e-9);
        expect(v).toBeLessThanOrEqual(0.82 + 1e-9);
      }
    }
    expect(points[1].x).toBeLessThan(points[2].x); // 서울숲 is west of 뚝섬
    expect(layoutPings([[127, 37.5]], 0)).toEqual([{ x: 0.5, y: 0.5 }]);
  });

  it('tells a tap from a long press, and ignores drags', () => {
    expect(classifyPress(120, 2)).toBe('tap');
    expect(classifyPress(600, 4)).toBe('long');
    expect(classifyPress(120, 30)).toBe('none');
    expect(pingKey('2026-09-30', SAMPLE_TODAY_PINGS[0])).toBe('2026-09-30|10:30|성수연방');
  });
});
