import { describe, expect, it } from 'vitest';
import { BASE_COLORS, clamp01, eraseAt, extendStroke, inkCss, isThemeId, PEN_TOOLS, STICKERS, THEMES, type Stroke } from './decor';

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

  it('the eraser lifts whole strokes it passes near, and leaves the rest', () => {
    const line = (y: number): Stroke => ({ tool: 'pen', color: 'ink-black', width: 'thin', points: [[0.1, y], [0.9, y]] });
    const strokes = [line(0.2), line(0.6)];
    expect(eraseAt(strokes, 0.5, 0.21, 0.02)).toEqual([line(0.6)]); // touches the middle of the first line
    expect(eraseAt(strokes, 0.5, 0.4, 0.02)).toBe(strokes); // nothing near: unchanged
  });
});
