import { describe, expect, it } from 'vitest';
import { pinRailNext, togglePicked } from './pinRail';

describe('pin rail', () => {
  it('folds and unfolds the 핀 · 경로 entries', () => {
    expect(pinRailNext('menu', 'fold')).toBe('folded');
    expect(pinRailNext('folded', 'fold')).toBe('menu');
  });

  it('opens 핀 or 경로 only from the entries, which then step aside', () => {
    expect(pinRailNext('menu', 'pins')).toBe('pins');
    expect(pinRailNext('menu', 'route')).toBe('route');
    expect(pinRailNext('folded', 'pins')).toBe('folded');
  });

  it('the fold button returns from an opened entry to 핀 · 경로', () => {
    expect(pinRailNext('pins', 'fold')).toBe('menu');
    expect(pinRailNext('route', 'fold')).toBe('menu');
  });

  it('picks several categories, and a second tap drops one', () => {
    const a = togglePicked(new Set(), 'cafe');
    const b = togglePicked(a, 'food');
    expect([...b]).toEqual(['cafe', 'food']);
    expect([...togglePicked(b, 'cafe')]).toEqual(['food']);
    expect([...a]).toEqual(['cafe']); // never mutates
  });
});
