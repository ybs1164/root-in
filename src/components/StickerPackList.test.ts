import { describe, expect, it } from 'vitest';
import type { StickerSheet } from '../domain/stickerSheets';
import { packGroups } from './StickerPackList';

const pack = (id: string, name: string): StickerSheet => ({ id, name, color: '#000000', ink: '#ffffff', motif: 'none', nameStyle: 'plain', slots: [] });

describe('packGroups', () => {
  it('groups packs by name in first-seen order and keeps each pack index', () => {
    const groups = packGroups([pack('a', 'MATCHA'), pack('b', 'BANANA'), pack('c', 'MATCHA')]);
    expect(groups.map((g) => g.name)).toEqual(['MATCHA', 'BANANA']);
    expect(groups[0].packs.map((p) => p.index)).toEqual([0, 2]);
    expect(groups[1].packs.map((p) => p.sheet.id)).toEqual(['b']);
  });
});
