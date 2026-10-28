import { describe, expect, it } from 'vitest';
import packsFile from './stickerPacks.json';
import packsText from './stickerPacks.json?raw';
import { formatPacks, layOutSheet, packsDocument, peelFold, readPacks, STICKER_SHEETS } from './stickerSheets';

describe('sticker packs', () => {
  it('reads the app\'s pack file as it is (nothing dropped or changed)', () => {
    expect(STICKER_SHEETS.length).toBe(packsFile.packs.length);
    expect(packsDocument(STICKER_SHEETS)).toEqual(packsFile);
    expect(new Set(STICKER_SHEETS.map((s) => s.id)).size).toBe(STICKER_SHEETS.length);
    for (const sheet of STICKER_SHEETS) expect(sheet.slots.length).toBeGreaterThan(0);
  });

  it('checks a file from the editor: bad packs and unknown stickers are dropped, numbers kept on the sheet', () => {
    const [good] = STICKER_SHEETS;
    const packs = readPacks({
      version: 1,
      packs: [
        { ...good, color: '#FFAA00', slots: [{ stickerId: good.slots[0].stickerId, x: 2, y: -1, size: 9, rotate: 400 }, { stickerId: 'nope', x: 0.5, y: 0.5, size: 0.2, rotate: 0 }] },
        { ...good, color: 'red' },
        { ...good, motif: 'zigzag', nameStyle: 'fancy', name: '  A VERY LONG PACK NAME HERE  ' },
        'junk',
      ],
    });
    expect(packs).toHaveLength(2);
    expect(packs[0].color).toBe('#ffaa00');
    expect(packs[0].slots).toEqual([{ stickerId: good.slots[0].stickerId, x: 1, y: 0, size: 0.6, rotate: 180 }]);
    // The same id twice: the second gets its own.
    expect(packs[1].id).not.toBe(packs[0].id);
    expect(packs[1].motif).toBe('none');
    expect(packs[1].nameStyle).toBe('plain');
    expect(packs[1].name).toHaveLength(16);
    expect(readPacks(null)).toEqual([]);
    expect(readPacks({ packs: 'x' })).toEqual([]);
  });

  it('tidies stickers into a grid on the sheet, the same every time', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `s${i}`);
    const slots = layOutSheet('a', ids);
    expect(slots).toEqual(layOutSheet('a', ids));
    for (const slot of slots) {
      expect(slot.x).toBeGreaterThan(0);
      expect(slot.x).toBeLessThan(1);
      expect(slot.y).toBeGreaterThan(0);
      expect(slot.y).toBeLessThan(1);
    }
    expect(layOutSheet('one', ['x'])[0].x).toBeCloseTo(0.5, 1);
  });

  it('folds the edge behind the pull over toward the finger', () => {
    expect(peelFold(0, 0, 100, 0, 0)).toBeNull();
    // Pulled right by 20: the left edge (at -42) lifts and the fold sits 10 past it.
    const fold = peelFold(0, 0, 100, 20, 0)!;
    expect([fold.nx, fold.ny]).toEqual([1, 0]);
    expect(fold.mx).toBeCloseTo(-32);
    expect(fold.progress).toBeCloseTo(20 / 60);
    expect(peelFold(0, 0, 100, 0, 200)!.progress).toBe(1);
  });
});

describe('formatPacks', () => {
  it('reads back as the same document, one line per slot, extra fields kept', () => {
    const doc = { ...packsDocument(STICKER_SHEETS), savedAt: '2026-10-28T00:00:00.000Z' };
    const text = formatPacks(doc);
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(doc)));
    const slots = STICKER_SHEETS.reduce((n, p) => n + p.slots.length, 0);
    expect(text.split('\n').filter((l) => l.trim().startsWith('{"stickerId"'))).toHaveLength(slots);
  });

  it('is how the packs file is kept', () => {
    expect(packsText).toBe(formatPacks(JSON.parse(packsText)));
  });
});
