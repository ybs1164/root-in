import { describe, expect, it } from 'vitest';
import { addDays } from './calendar';
import { classifyPress, daySwipeTarget, dayTitle, EDGE_STYLES, edgeKey, latestPingIndex, layoutPings, pingCounts, pingKey, pinchOutcome, pinchProgress, pingsForDate, pingsLandedMs, todayCandidates, type DayPing, type StoredPing } from './dayPings';

const SAMPLE_TODAY_PINGS: DayPing[] = [
  { name: '성수연방', time: '10:30', center: [127.056, 37.5475] },
  { name: '서울숲', time: '13:00', center: [127.0374, 37.5444] },
  { name: '뚝섬한강공원', time: '17:40', center: [127.067, 37.529] },
];

// Local times: `at` is read back in the device's own time zone.
const stored = (id: string, day: string, hhmm: string, name: string): StoredPing => ({
  id,
  day,
  at: new Date(`${day}T${hhmm}:00`).toISOString(),
  name,
  center: [127, 37.5],
});

describe('calendar day screen', () => {
  it('titles today as TODAY and other days as DAY <n>', () => {
    expect(dayTitle('2026-09-30', '2026-09-30')).toBe('TODAY');
    expect(dayTitle('2026-09-29', '2026-09-30')).toBe('DAY 29');
    expect(dayTitle('2026-10-05', '2026-09-30')).toBe('DAY 5');
  });

  it('pings belong to their date, in the order they were made', () => {
    const all = [stored('b', '2026-09-30', '13:00', '서울숲'), stored('a', '2026-09-30', '10:30', '성수연방'), stored('c', '2026-09-29', '19:10', '을지로')];
    expect(pingsForDate('2026-09-30', all).map((p) => [p.time, p.name])).toEqual([['10:30', '성수연방'], ['13:00', '서울숲']]);
    // The next day starts empty; 9/30 keeps its places.
    expect(pingsForDate('2026-10-01', all)).toEqual([]);
    expect(pingCounts(all)).toEqual(new Map([['2026-09-30', 2], ['2026-09-29', 1]]));
  });

  it("offers TODAY your pins within 50m that today doesn't have yet, nearest first", () => {
    const pin = (id: string, lon: number) => ({ id, place: { center: [lon, 37.5] as [number, number] } });
    const here: [number, number] = [127, 37.5];
    const pins = [pin('far', 127.001), pin('near', 127.0003), pin('nearest', 127.0001), pin('taken', 127)];
    const today = [{ ...stored('t', '2026-10-08', '09:00', '집 앞'), pinId: 'taken' }];
    expect(todayCandidates(pins, here, today).map((p) => p.id)).toEqual(['nearest', 'near']); // ~9m, ~27m; far is ~88m
    expect(todayCandidates(pins, null, [])).toEqual([]);
  });

  it('pages days by swiping: left-to-right goes back, right-to-left goes forward except on TODAY', () => {
    const today = '2026-09-30';
    expect(daySwipeTarget(today, today, 80)).toBe('2026-09-29');
    expect(daySwipeTarget('2026-09-29', today, 80)).toBe('2026-09-28');
    expect(daySwipeTarget(today, today, -80)).toBeNull(); // the page goes to the map
    expect(daySwipeTarget('2026-09-28', today, -80)).toBe('2026-09-29');
    expect(daySwipeTarget('2026-09-29', today, -80)).toBe(today);
    expect(daySwipeTarget('2026-10-01', '2026-10-01', 5)).toBe('2026-09-30'); // across months
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
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
    expect(pinchOutcome(0.7, false)).toBe('switch');
    expect(pinchOutcome(0.8, false)).toBe('stay');
    expect(pinchOutcome(0.88, true)).toBe('switch');
    expect(pinchOutcome(0.95, true)).toBe('stay');
    expect(pinchOutcome(1.5, false)).toBe('switch');
    expect(pinchOutcome(1.4, false)).toBe('stay');
    expect(pinchOutcome(1.15, true)).toBe('switch');
    expect(pinchOutcome(1.05, true)).toBe('stay');
    expect(pinchProgress(1)).toBe(0);
    expect(pinchProgress(0.7)).toBe(1);
    expect(pinchProgress(1.25)).toBeCloseTo(0.5);
  });

  it('picks the latest ping by time, whatever the list order', () => {
    const at = (time: string) => ({ name: time, time, center: [127, 37.5] as [number, number] });
    expect(latestPingIndex([at('10:30'), at('17:40'), at('13:00')])).toBe(1);
    expect(latestPingIndex(SAMPLE_TODAY_PINGS)).toBe(2);
    expect(latestPingIndex([])).toBe(-1);
  });

  it('spreads pings over the whole drawing on both axes', () => {
    const points = layoutPings(SAMPLE_TODAY_PINGS.map((p) => p.center));
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(0.18);
    expect(Math.max(...xs)).toBeCloseTo(0.82);
    expect(Math.min(...ys)).toBeCloseTo(0.18);
    expect(Math.max(...ys)).toBeCloseTo(0.82);
    // Two places on the same latitude stay level, in the middle.
    const level = layoutPings([
      [127.0, 37.5],
      [127.02, 37.5],
    ]);
    expect(level.map((p) => p.y)).toEqual([0.5, 0.5]);
  });

  it('tells a tap from a long press, and ignores drags', () => {
    expect(classifyPress(120, 2)).toBe('tap');
    expect(classifyPress(600, 4)).toBe('long');
    expect(classifyPress(120, 30)).toBe('none');
    expect(pingKey('2026-09-30', SAMPLE_TODAY_PINGS[0])).toBe('2026-09-30|10:30|성수연방');
  });

  it('keys a line by the two pings it joins, and offers four line styles', () => {
    const [a, b] = SAMPLE_TODAY_PINGS;
    expect(edgeKey('2026-09-30', a, b)).toBe('2026-09-30|10:30|성수연방>13:00|서울숲');
    expect(edgeKey('2026-09-30', b, a)).not.toBe(edgeKey('2026-09-30', a, b));
    expect(EDGE_STYLES.map((e) => e.style)).toEqual(['solid', 'dashed', 'dotted', 'bold']);
  });

  it('knows when a day’s pins and lines have landed, for the decorations to follow', () => {
    expect(pingsLandedMs(0)).toBe(0);
    expect(pingsLandedMs(1)).toBe(570); // one pin, no line
    expect(pingsLandedMs(3)).toBe(910); // the lines look drawn last
    expect(pingsLandedMs(8)).toBe(120 + 7 * 110 + 450); // many pins: the last drop
  });
});
