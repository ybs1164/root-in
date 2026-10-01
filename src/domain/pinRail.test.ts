import { describe, expect, it } from 'vitest';
import { pinRailNext, togglePicked } from './pinRail';

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
});
