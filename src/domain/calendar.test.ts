import { describe, expect, it } from 'vitest';
import { addDays, monthGrid, shiftMonth } from './calendar';

describe('calendar', () => {
  it('month grid is six Sunday-first weeks with the month flagged', () => {
    const grid = monthGrid(2026, 8); // September 2026 starts on a Tuesday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ key: '2026-08-30', day: 30, inMonth: false });
    expect(grid[2]).toEqual({ key: '2026-09-01', day: 1, inMonth: true });
    expect(grid.filter((d) => d.inMonth)).toHaveLength(30);
  });

  it('shifts months across years', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('steps a date key by days across months and years', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-11-16', -7)).toBe('2026-11-09');
  });
});
