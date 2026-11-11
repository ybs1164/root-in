import { describe, expect, it } from 'vitest';
import { parsePing } from '../services/pingRepository';
import { buildDemoPings } from './demoPings';

describe('demo pings (dev only)', () => {
  const now = new Date(2026, 10, 11, 20, 0);
  const demo = buildDemoPings(now);

  it('are valid local pings, so they are kept and never synced', () => {
    for (const { ping } of demo) {
      expect(parsePing(ping)).toEqual(ping);
      expect(ping.local).toBe(true);
      expect(ping.id.startsWith('demo-')).toBe(true);
    }
  });

  it('give days with several pings, days with one and days with none, photos and no photos', () => {
    const perDay = new Map<string, number>();
    for (const { ping } of demo) perDay.set(ping.day, (perDay.get(ping.day) ?? 0) + 1);
    expect(perDay.get('2026-11-11')).toBe(3);
    expect(perDay.get('2026-11-05')).toBe(1);
    expect(perDay.has('2026-11-09')).toBe(false);
    expect(demo.some((d) => d.photo)).toBe(true);
    expect(demo.some((d) => !d.photo)).toBe(true);
  });
});
