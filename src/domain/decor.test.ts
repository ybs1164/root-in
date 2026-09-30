import { describe, expect, it } from 'vitest';
import { clamp01, extendStroke, isThemeId, PEN_COLORS, STICKERS, THEMES } from './decor';

describe('day decorations', () => {
  it('keeps stroke points inside the box and skips tiny moves', () => {
    let pts = extendStroke([], 0.5, 0.5);
    pts = extendStroke(pts, 0.501, 0.5); // too close: dropped
    expect(pts).toEqual([[0.5, 0.5]]);
    pts = extendStroke(pts, 1.4, -0.2); // off the box: clamped
    expect(pts).toEqual([
      [0.5, 0.5],
      [1, 0],
    ]);
    expect(clamp01(-3)).toBe(0);
  });

  it('offers stickers, pen colours and themes, and knows theme ids', () => {
    expect(STICKERS.length).toBeGreaterThan(10);
    expect(PEN_COLORS[0].color).toBe('text');
    expect(THEMES[0].id).toBe('default');
    expect(isThemeId('mint')).toBe(true);
    expect(isThemeId('forest')).toBe(false);
  });
});
