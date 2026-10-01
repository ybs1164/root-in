import { describe, expect, it } from 'vitest';
import { BASE_COLORS, EMPTY_HISTORY, recordChange, redoDecor, undoDecor, type DayDecor, type Stroke, STICKER_MAX, stickerGesture, clamp01, extendStroke, hexToHsv, hsvToHex, inkCss, isBlankText, cleanTextStyle, TEXT_MIN, TEXT_MAX, isThemeId, normalizeHex, PEN_TOOLS, STICKERS, THEMES } from './decor';

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

  it('moves, scales and turns a sticker under the fingers', () => {
    const base = { x: 0.5, y: 0.5, size: 0.1, rotate: 0 };
    // One finger: moves by box fractions.
    expect(stickerGesture(base, [{ x: 0, y: 0 }], [{ x: 30, y: -30 }], 300)).toMatchObject({ x: 0.6, y: 0.4, size: 0.1 });
    // Two fingers spreading to twice apart and turning a quarter clockwise.
    const out = stickerGesture(base, [{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 150, y: 0 }, { x: 150, y: 200 }], 300);
    expect(out.size).toBeCloseTo(0.2);
    expect(out.rotate).toBeCloseTo(90);
    expect(out.x).toBeCloseTo(0.5);
    expect(out.y).toBeCloseTo(0.5);
    // Spreading a lot stops at the biggest size.
    expect(stickerGesture(base, [{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: 0 }, { x: 1000, y: 0 }], 300).size).toBe(STICKER_MAX);
  });

  it('undo and redo step through changes; a new change forgets what was undone', () => {
    const line = (x: number): Stroke => ({ tool: 'pen', color: 'accent', width: 'thin', points: [[x, x]] });
    const a: DayDecor = { stickers: [], strokes: [line(0.1)], theme: 'mint' };
    const b: DayDecor = { ...a, strokes: [...a.strokes, line(0.2)] };
    let h = recordChange(EMPTY_HISTORY, a);
    const undone = undoDecor(h, b)!;
    expect(undone.decor).toEqual(a);
    const redone = redoDecor(undone.history, undone.decor)!;
    expect(redone.decor).toEqual(b);
    // Undo, then draw something else: redo has nothing left.
    h = recordChange(undone.history, undone.decor);
    expect(h.future).toEqual([]);
    expect(redoDecor(h, a)).toBeNull();
    // Clearing all is a change too, and undo brings it back (theme untouched).
    const cleared = { ...b, strokes: [], stickers: [] };
    expect(undoDecor(recordChange(EMPTY_HISTORY, b), cleared)!.decor).toEqual(b);
    // Nothing remembered (after a reload): undo still takes back the last stroke.
    expect(undoDecor(EMPTY_HISTORY, b)!.decor.strokes).toEqual(a.strokes);
    expect(undoDecor(EMPTY_HISTORY, { stickers: [], strokes: [] })).toBeNull();
  });

  it('a text box with nothing but spaces, tabs or line breaks counts as blank', () => {
    for (const t of ['', ' ', '   ', '\n', '\n\n', '\t', ' \t\n ', '\u3000', '\u200b']) expect(isBlankText(t)).toBe(true);
    for (const t of ['a', ' 가 ', '\n.\n', '❤️']) expect(isBlankText(t)).toBe(false);
  });

  it('stores only the text effects that are on', () => {
    expect(cleanTextStyle({ font: 'serif', color: 'accent', align: 'right', bold: true, italic: false })).toEqual({
      font: 'serif', color: 'accent', align: 'right', bold: true,
    });
  });

  it('a pinched text box stays within its own size limits', () => {
    const base = { x: 0.5, y: 0.5, size: 0.1, rotate: 0 };
    const from = [{ x: 100, y: 100 }, { x: 200, y: 100 }];
    const limits = { min: TEXT_MIN, max: TEXT_MAX };
    expect(stickerGesture(base, from, [{ x: 0, y: 100 }, { x: 1000, y: 100 }], 300, limits).size).toBe(TEXT_MAX);
    expect(stickerGesture(base, from, [{ x: 149, y: 100 }, { x: 151, y: 100 }], 300, limits).size).toBe(TEXT_MIN);
  });

  it('undo brings back text boxes too', () => {
    const before: DayDecor = { stickers: [], strokes: [], texts: [] };
    const after: DayDecor = { ...before, texts: [{ id: 't', text: '안녕', x: 0.5, y: 0.5, size: 0.07, font: 'sans', color: 'ink-black', align: 'center' }] };
    const h = recordChange(EMPTY_HISTORY, before);
    expect(undoDecor(h, after)!.decor.texts).toEqual([]);
    // From a day saved before texts existed: undo clears the new box.
    expect(undoDecor(recordChange(EMPTY_HISTORY, { stickers: [], strokes: [] }), after)!.decor.texts).toBeUndefined();
  });
});
