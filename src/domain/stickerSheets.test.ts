import { describe, expect, it } from 'vitest';
import packsFile from './stickerPacks.json';
import packsText from './stickerPacks.json?raw';
import { formatPacks, listInk, layOutSheet, oneIconPerTheme, orderPackGroups, packGroups, setThemeIcon, setThemeIconBg, themeIcon, themeIconBg, packsDocument, squareTarget, peelFold, readPacks, PACK_MOTIFS, STICKER_SHEETS, type StickerSheet } from './stickerSheets';

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
        { ...good, motif: 'paisley', nameStyle: 'fancy', name: '  A VERY LONG PACK NAME HERE  ' },
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

describe('theme icon', () => {
  const ids = [...new Set(STICKER_SHEETS.flatMap((p) => p.slots.map((sl) => sl.stickerId)))];
  const [a, b, c] = ids;
  const pack = (id: string, name: string, stickers: string[], icon?: unknown) => ({
    id, name, color: '#000000', ink: '#ffffff', icon, slots: stickers.map((stickerId) => ({ stickerId, x: 0.5, y: 0.5, size: 0.2 })),
  });

  it('keeps an icon only when that sticker is on the pack', () => {
    expect(readPacks({ packs: [pack('p', 'A', [a, b], b)] })[0].icon).toBe(b);
    expect(readPacks({ packs: [pack('p', 'A', [a], b)] })[0].icon).toBeUndefined();
    expect(readPacks({ packs: [pack('p', 'A', [a], 42)] })[0].icon).toBeUndefined();
  });

  it('keeps one icon per theme, the first pack of the name that has one', () => {
    const read = readPacks({ packs: [pack('p', 'A', [a, b], b), pack('q', 'A', [c], c), pack('r', 'B', [c], c)] });
    expect(read.map((p) => p.icon)).toEqual([b, undefined, c]);
    expect(oneIconPerTheme(read)).toBe(read);
  });

  it('writes the icon into the pack file and reads it back', () => {
    const packs = readPacks({ packs: [pack('p', 'A', [a, b], b)] });
    expect(readPacks(JSON.parse(formatPacks(packsDocument(packs))))[0].icon).toBe(b);
  });

  it('sets a theme icon on one pack that has the sticker, off the rest of the theme', () => {
    const packs = readPacks({ packs: [pack('p', 'A', [a], a), pack('q', 'A', [b, c]), pack('r', 'B', [c], c)] });
    const next = setThemeIcon(packs, 'A', c);
    expect(next.map((p) => p.icon)).toEqual([undefined, c, c]);
    expect(themeIcon(next.filter((p) => p.name === 'A'))).toBe(c);
    const back = setThemeIcon(next, 'A', undefined);
    expect(back.map((p) => p.icon)).toEqual([undefined, undefined, c]);
    expect(themeIcon(back.filter((p) => p.name === 'A'))).toBe(a);
    expect(themeIcon([])).toBeUndefined();
  });
});

describe('theme square background', () => {
  const [a] = [...new Set(STICKER_SHEETS.flatMap((p) => p.slots.map((sl) => sl.stickerId)))];
  const pack = (id: string, name: string, iconBg?: unknown) => ({
    id, name, color: '#123456', ink: '#ffffff', iconBg, slots: [{ stickerId: a, x: 0.5, y: 0.5, size: 0.2 }],
  });

  it('reads a colour or transparent, and drops anything else', () => {
    const read = readPacks({ packs: [pack('p', 'A', '#FFAA00'), pack('q', 'B', 'transparent'), pack('r', 'C', 'red'), pack('s', 'D', 7)] });
    expect(read.map((p) => p.iconBg)).toEqual(['#ffaa00', 'transparent', undefined, undefined]);
  });

  it('keeps one per theme and falls back to the band colour', () => {
    const read = readPacks({ packs: [pack('p', 'A'), pack('q', 'A', '#00ff00'), pack('r', 'A', 'transparent')] });
    expect(read.map((p) => p.iconBg)).toEqual([undefined, '#00ff00', undefined]);
    expect(themeIconBg(read)).toBe('#00ff00');
    expect(themeIconBg([read[0]])).toBe('#123456');
    expect(themeIconBg([])).toBeUndefined();
  });

  it('sets it on the theme\'s first pack, writes it to the file, and clears it', () => {
    const packs = readPacks({ packs: [pack('p', 'A'), pack('q', 'A', '#00ff00'), pack('r', 'B')] });
    const clear = setThemeIconBg(packs, 'A', 'transparent');
    expect(clear.map((p) => p.iconBg)).toEqual(['transparent', undefined, undefined]);
    expect(readPacks(JSON.parse(formatPacks(packsDocument(clear))))[0].iconBg).toBe('transparent');
    expect(setThemeIconBg(clear, 'A', undefined).map((p) => p.iconBg)).toEqual([undefined, undefined, undefined]);
    expect(setThemeIconBg(packs, 'B', 'nope')[2].iconBg).toBeUndefined();
  });
});

describe('listInk', () => {
  it('uses the name ink, or the band colour when the ink is white-ish', () => {
    expect(listInk({ ink: '#3e5329', color: '#a3c46f' })).toBe('#3e5329');
    expect(listInk({ ink: '#ffffff', color: '#6f4128' })).toBe('#6f4128');
    expect(listInk({ ink: '#fffaf0', color: '#6f4128' })).toBe('#6f4128');
  });
});
