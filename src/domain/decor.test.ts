import { describe, expect, it } from 'vitest';
import { BASE_COLORS, clamp01, extendStroke, hexToHsv, hsvToHex, inkCss, isThemeId, normalizeHex, PEN_TOOLS, STICKERS, THEMES } from './decor';

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
    expect(PEN_TOOLS.map((t) => t.tool)).toEqual(['pen', 'highlighter', 'neon', 'eraser']);
    expect(BASE_COLORS.map((c) => c.label)).toEqual(['검정', '흰색', '테마 색']);
    expect(THEMES[0].id).toBe('default');
    expect(isThemeId('mint')).toBe(true);
    expect(isThemeId('forest')).toBe(false);
  });

  it('ink colours: tokens become CSS variables, palette picks stay as they are', () => {
    expect(inkCss('accent')).toBe('var(--accent)');
    expect(inkCss('#12ab9f')).toBe('#12ab9f');
  });

  it('reads colour codes the way people type them', () => {
    expect(normalizeHex('#FF8800')).toBe('#ff8800');
    expect(normalizeHex(' 3aa0ff ')).toBe('#3aa0ff');
    expect(normalizeHex('#f80')).toBe('#ff8800');
    expect(normalizeHex('#ff88')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
  });

  it('converts between the colour wheel (HSV) and colour codes', () => {
    expect(hsvToHex(0, 1, 1)).toBe('#ff0000');
    expect(hsvToHex(120, 1, 1)).toBe('#00ff00');
    expect(hsvToHex(240, 1, 1)).toBe('#0000ff');
    expect(hsvToHex(200, 0, 1)).toBe('#ffffff'); // the wheel's centre
    expect(hsvToHex(200, 1, 0)).toBe('#000000'); // brightness all the way down
    const { h, s, v } = hexToHsv('#3aa0ff');
    expect(hsvToHex(h, s, v)).toBe('#3aa0ff');
  });
});
