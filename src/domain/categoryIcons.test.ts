import { describe, expect, it } from 'vitest';
import { PIN_GLYPHS, pinGlyphSvg } from '../lib/pinGlyphs';
import { PIN_ICONS, type PinIcon } from '../types/pin';
import { filterCategoryIcons, PIN_ICON_GROUPS, QUICK_PIN_ICONS } from './categoryIcons';

describe('category icon library', () => {
  it('offers the requested five shortcuts and groups every supported icon once', () => {
    expect(QUICK_PIN_ICONS).toEqual(['pin', 'cafe', 'food', 'photo', 'star']);
    const icons = PIN_ICON_GROUPS.flatMap((g) => g.icons);
    expect(new Set(icons).size).toBe(icons.length);
    expect([...icons].sort()).toEqual(Object.keys(PIN_ICONS).sort());
  });

  it('has generated artwork for every icon in both React and map markers', () => {
    for (const icon of Object.keys(PIN_ICONS) as PinIcon[]) {
      expect(PIN_GLYPHS[icon], icon).toMatch(/<(path|circle|rect|ellipse|g)\b/);
      expect(pinGlyphSvg(icon)).not.toContain('undefined');
      expect(PIN_GLYPHS[icon]).not.toMatch(/<script|\bon\w+=|https?:/i);
    }
  });

  it('filters by Korean names or ids, within the selected group', () => {
    expect(filterCategoryIcons(' 비행기 ')).toEqual([{ ...PIN_ICON_GROUPS[3], icons: ['plane'] }]);
    expect(filterCategoryIcons('PLANE', 'transport')[0].icons).toEqual(['plane']);
    expect(filterCategoryIcons('비행기', 'animals')).toEqual([]);
    expect(filterCategoryIcons('없는 아이콘')).toEqual([]);
  });
});
