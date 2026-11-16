import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import manifest from '../../public/stickers/theme-stationery-20261115/manifest.json';
import additions from '../../public/stickers/theme-cute-20261116/manifest.json';
import recovered from '../../public/stickers/theme-recovered-20261116/manifest.json';
const assets = [...manifest.assets, ...additions.assets, ...recovered.assets];
import { EDITOR_STICKERS, getSticker, THEME_STICKERS } from './decor';
import { packsDocument, readPacks } from './stickerSheets';

describe('theme stickers in the pack editor', () => {
  it('resolves all four complete themes to existing assets', () => {
    expect(THEME_STICKERS).toHaveLength(276);
    for (const theme of ['matcha', 'banana', 'strawberry', 'choco']) {
      expect(assets.filter(a => a.theme === theme)).toHaveLength(69);
    }
    for (const asset of assets) {
      expect(existsSync(`public/${asset.src}`)).toBe(true);
      expect(getSticker(asset.id)?.label).toBe(asset.label);
      expect(EDITOR_STICKERS.some(a => a.id === asset.id)).toBe(true);
    }
    expect(new Set(EDITOR_STICKERS.map(a => a.id)).size).toBe(EDITOR_STICKERS.length);
  });

  it('retains new asset IDs and placement through pack export and import', () => {
    for (const asset of THEME_STICKERS) {
      const pack = { id: 'theme-test', name: 'THEME', color: '#a3c46f', ink: '#3e5329', motif: 'none' as const, nameStyle: 'plain' as const,
        slots: [{ stickerId: asset.id, x: .2, y: .4, size: .25, rotate: 10 }] };
      expect(readPacks(packsDocument([pack]))[0]).toEqual(pack);
    }
  });
});
