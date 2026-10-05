import { describe, expect, it } from 'vitest';
import { PIN_GLYPHS, pinGlyphSvg } from '../lib/pinGlyphs';
import { PIN_ICONS, type PinIcon } from '../types/pin';
import { PIN_ICON_GROUPS, QUICK_PIN_ICONS } from './categoryIcons';

describe('category icon library', () => {
  it('offers the requested five shortcuts and groups every supported icon once', () => {
    expect(QUICK_PIN_ICONS).toEqual(['pin', 'cafe', 'food', 'photo', 'star']);
    const icons = PIN_ICON_GROUPS.flatMap((g) => g.icons);
    expect(new Set(icons).size).toBe(icons.length);
    // Retired artwork remains readable in saved categories and older share links.
    expect(icons).not.toContain('waterfall');
    expect([...icons].sort()).toEqual(Object.keys(PIN_ICONS).filter((icon) => icon !== 'waterfall').sort());
  });

  it('has generated artwork for every icon in both React and map markers', () => {
    for (const icon of Object.keys(PIN_ICONS) as PinIcon[]) {
      expect(PIN_GLYPHS[icon], icon).toMatch(/<(path|circle|rect|ellipse|g)\b/);
      expect(pinGlyphSvg(icon)).not.toContain('undefined');
      expect(PIN_GLYPHS[icon]).not.toMatch(/<script|\bon\w+=|https?:/i);
    }
  });

  it('places the flower in nature, rather than places', () => {
    expect(PIN_ICON_GROUPS.find((g) => g.id === 'nature')?.icons).toContain('flower');
    expect(PIN_ICON_GROUPS.find((g) => g.id === 'places')?.icons).not.toContain('flower');
  });
});
