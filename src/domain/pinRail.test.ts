import { describe, expect, it } from 'vitest';
import { isAllPicked, pinRailNext, railPage, railPageCount, togglePicked } from './pinRail';

describe('pin rail', () => {
  it('opens 핀 or 경로 from the menu', () => {
    expect(pinRailNext('menu', 'pins')).toBe('pins');
    expect(pinRailNext('menu', 'route')).toBe('route');
  });

  it('a second tap on the open entry closes it', () => {
    expect(pinRailNext('pins', 'pins')).toBe('menu');
    expect(pinRailNext('route', 'route')).toBe('menu');
  });

  it('핀 stays out while 경로 is open, and tapping it switches over', () => {
    expect(pinRailNext('route', 'pins')).toBe('pins');
  });

  it('picks several categories, and a second tap drops one', () => {
    const a = togglePicked(new Set(), 'cafe');
    const b = togglePicked(a, 'food');
    expect([...b]).toEqual(['cafe', 'food']);
    expect([...togglePicked(b, 'cafe')]).toEqual(['food']);
    expect([...a]).toEqual(['cafe']); // never mutates
  });

  it('ALL is on with nothing picked, off once a category is, and back on when the last is dropped', () => {
    const ids = ['cafe', 'food'];
    expect(isAllPicked(new Set(), ids)).toBe(true);
    const one = togglePicked(new Set(), 'cafe');
    expect(isAllPicked(one, ids)).toBe(false);
    expect(isAllPicked(togglePicked(one, 'cafe'), ids)).toBe(true);
    // A picked category since deleted doesn't count.
    expect(isAllPicked(new Set(['gone']), ids)).toBe(true);
  });

  it('shows the categories five at a time; ↓ past the last set goes back to the first', () => {
    const seven = ['none', 'cafe', 'food', 'bar', 'photo', 'shop', 'togo'];
    expect(railPageCount(seven.length)).toBe(2);
    expect(railPage(seven, 0)).toEqual(['none', 'cafe', 'food', 'bar', 'photo']);
    expect(railPage(seven, 1)).toEqual(['shop', 'togo']);
    expect(railPage(seven, 2)).toEqual(railPage(seven, 0));
    // Five or fewer: one set, so no ↓.
    expect(railPageCount(5)).toBe(1);
    expect(railPageCount(0)).toBe(1);
  });
});
