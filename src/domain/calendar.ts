import { dateKey } from './diary';

export interface CalendarDay {
  key: string;
  day: number;
  /** False for the leading/trailing days borrowed from the adjacent months. */
  inMonth: boolean;
}

/**
 * Six Sunday-first weeks covering `month` (0-based). A fixed 6 rows keeps
 * the sheet from jumping in height when paging between months.
 */
export function monthGrid(year: number, month: number): CalendarDay[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { key: dateKey(date), day: date.getDate(), inMonth: date.getMonth() === month };
  });
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** Number of stops per date — drives the dots under each day. */
export function stopCountsByDate(entries: { date: string; stops: unknown[] }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.date, (counts.get(entry.date) ?? 0) + entry.stops.length);
  return counts;
}

export const isFutureDate = (key: string, today: string = dateKey()): boolean => key > today;
