import { describe, expect, it } from 'vitest';
import approved from '../../docs/sticker-order-20261019.json';
import { getSticker, STICKERS } from './decor';

describe('approved sticker tray', () => {
  it('uses the saved order and excludes unchecked stickers', () => {
    expect(approved.completed).toBe(true);
    expect(STICKERS.map(sticker => sticker.id)).toEqual(
      approved.ids.filter(id => !approved.removedIds.includes(id)),
    );
    expect(new Set(STICKERS.map(sticker => sticker.id)).size).toBe(STICKERS.length);
  });

  it('keeps unchecked stickers available to existing artwork', () => {
    for (const id of approved.removedIds) {
      expect(STICKERS.some(sticker => sticker.id === id)).toBe(false);
      expect(getSticker(id)?.src).toMatch(/stickers\/.+\.png(?:\?v=.+)?$/);
    }
  });
});
