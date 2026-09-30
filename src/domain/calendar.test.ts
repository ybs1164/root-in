import { describe, expect, it } from 'vitest';
import { dayDots, isFutureDate, monthGrid, shiftMonth, stopCountsByDate } from './calendar';

describe('calendar', () => {
  it('month grid is six Sunday-first weeks with the month flagged', () => {
    const grid = monthGrid(2026, 8); // September 2026 starts on a Tuesday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ key: '2026-08-30', day: 30, inMonth: false });
    expect(grid[2]).toEqual({ key: '2026-09-01', day: 1, inMonth: true });
    expect(grid.filter((d) => d.inMonth)).toHaveLength(30);
  });

  it('month grid marks days that have a route', () => {
    const counts = stopCountsByDate([
      { date: '2026-09-28', stops: [1, 2] },
      { date: '2026-09-29', stops: [1] },
    ]);
    expect(counts.get('2026-09-28')).toBe(2);
    expect(counts.get('2026-09-30')).toBeUndefined();
  });

  it('shifts months across years', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('compares date keys against today', () => {
    expect(isFutureDate('2026-09-30', '2026-09-29')).toBe(true);
    expect(isFutureDate('2026-09-29', '2026-09-29')).toBe(false);
  });
});

describe('month grid dots', () => {
  it('shows one dot per place, up to ten', () => {
    expect(dayDots(0)).toBe(0);
    expect(dayDots(4)).toBe(4);
    expect(dayDots(10)).toBe(10);
    expect(dayDots(23)).toBe(10);
  });
});
