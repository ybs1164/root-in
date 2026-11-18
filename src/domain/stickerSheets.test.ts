import { describe, expect, it } from 'vitest';
import packsFile from './stickerPacks.json';
import packsText from './stickerPacks.json?raw';
import { formatPacks, layOutSheet, orderPackGroups, packGroups, packsDocument, squareTarget, peelFold, readPacks, PACK_MOTIFS, STICKER_SHEETS, type StickerSheet } from './stickerSheets';

describe('sticker packs', () => {
  it('retains every band motif through editor export and import', () => {
    for (const { motif } of PACK_MOTIFS) {
      const pack = { ...STICKER_SHEETS[0], motif };
      expect(readPacks(JSON.parse(formatPacks(packsDocument([pack]))))[0]).toEqual(pack);
    }
  });

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

describe('packGroups', () => {
  const pack = (id: string, name: string): StickerSheet => ({ id, name, color: '#000000', ink: '#ffffff', motif: 'none', nameStyle: 'plain', slots: [] });
  it('groups packs by name in first-seen order and keeps each pack index', () => {
    const groups = packGroups([pack('a', 'MATCHA'), pack('b', 'BANANA'), pack('c', 'MATCHA')]);
    expect(groups.map((g) => g.name)).toEqual(['MATCHA', 'BANANA']);
    expect(groups[0].packs.map((p) => p.index)).toEqual([0, 2]);
    expect(groups[1].packs.map((p) => p.sheet.id)).toEqual(['b']);
  });
});

describe('orderPackGroups', () => {
  it('puts dragged themes first in my order and keeps the rest in their own', () => {
    const g = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];
    expect(orderPackGroups(g, ['C', 'A', 'GONE']).map((x) => x.name)).toEqual(['C', 'A', 'B', 'D']);
    expect(orderPackGroups(g, []).map((x) => x.name)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('squareTarget', () => {
  it('counts the other squares left of the dragged centre', () => {
    const centers = [50, 150, 250, 350];
    expect(squareTarget(centers, 0, 0)).toBe(0);
    expect(squareTarget(centers, 0, 160)).toBe(1);
    expect(squareTarget(centers, 0, 210)).toBe(2);
    expect(squareTarget(centers, 3, -320)).toBe(0);
  });
});
