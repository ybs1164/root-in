import { describe, expect, it } from 'vitest';
import styles from '../styles.css?raw';

// `:root` token blocks (also inside @media).
const tokenBlocks = (css: string) => [...css.matchAll(/(:root[^{]*)\{([^}]*)\}/g)];

describe('styles.css', () => {
  it('colors come only from :root tokens (CLAUDE.md)', () => {
    expect(styles.length).toBeGreaterThan(0);
    const componentCss = tokenBlocks(styles)
      .reduce((css, b) => css.replace(b[0], ''), styles)
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(componentCss.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) ?? []).toEqual([]);
  });

  // Every token block (themes, dark) with its tokens resolved to RGB: the map
  // roles are color-mix over var() (docs/plan-mainmap-style.md M1).
  const blocks = tokenBlocks(styles).map(([, selector, body]) => ({
    selector: selector.trim(),
    tokens: Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])),
  }));
  // The plain :root tokens are spread over several blocks.
  const root: Record<string, string> = Object.assign({}, ...blocks.filter((b) => b.selector === ':root').map((b) => b.tokens));
  const hex = (v: string): number[] | null => (/^#[0-9a-f]{6}$/i.test(v) ? [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) : null);
  /** A token's colour in a block (falling back to :root), following var() and color-mix(in srgb, A n%, B). */
  const colourIn = (tokens: Record<string, string>) => {
    const get = (name: string, depth = 0): number[] | null => {
      const value = tokens[name] ?? root[name] ?? '';
      if (depth > 8) return null;
      const alias = /^var\((--[\w-]+)\)$/.exec(value);
      if (alias) return get(alias[1], depth + 1);
      const mix = /^color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, var\((--[\w-]+)\)\)$/.exec(value);
      if (mix) {
        const [a, b] = [get(mix[1], depth + 1), get(mix[3], depth + 1)];
        const share = Number(mix[2]) / 100;
        return a && b ? a.map((v, i) => v * share + b[i] * (1 - share)) : null;
      }
      return hex(value);
    };
    return get;
  };
  const luminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: number[], b: number[]) => {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  /** Each block that sets a palette (the base, dark, every theme), with its colour getter. */
  const palettes = () =>
    blocks.filter((b) => b.tokens['--accent']).map(({ selector, tokens }) => ({ selector, get: colourIn(tokens) }));

  it('the map roles are made from the theme, so every theme and the dark scheme get their own map', () => {
    for (const role of ['--map-land', '--map-water', '--map-park', '--map-road', '--map-road-edge', '--map-tint', '--map-side', '--map-shadow']) {
      expect(root[role], role).toMatch(/^(color-mix|var)\(/);
      for (const { selector } of blocks.filter((b) => b.selector !== ':root')) {
        expect(blocks.find((b) => b.selector === selector)!.tokens[role], `${selector} ${role}`).toBeUndefined();
      }
    }
    // The 미니맵 draws the same colours.
    for (const role of ['land', 'side', 'water', 'park', 'road', 'shadow', 'haze']) expect(root[`--mini-${role}`]).toBe(`var(--map-${role})`);
  });

  it("the map's land stays quiet: the route line keeps most of its contrast on it, in every theme", () => {
    const checked: string[] = [];
    for (const { selector, get } of palettes()) {
      const [surface, route, land] = [get('--surface'), get('--route'), get('--map-land')];
      if (!surface || !route || !land) continue;
      // Most of the line's contrast with the page is kept on land (or it stays plainly readable, as on 모노's black).
      expect(contrast(route, land), selector).toBeGreaterThanOrEqual(Math.min(contrast(route, surface) * 0.75, 4.5));
      // …while the land still shows against the page.
      expect(contrast(land, surface), selector).toBeGreaterThanOrEqual(1.08);
      checked.push(selector);
    }
    expect(checked.length).toBeGreaterThan(10);
  });

  it('on the main map, water, parks and roads stand apart from the land, and area names stay readable', () => {
    const checked: string[] = [];
    for (const { selector, get } of palettes()) {
      const [land, water, park, road, accent, text, route] = ['--map-land', '--map-water', '--map-park', '--map-road', '--accent', '--text', '--route'].map((n) => get(n));
      if (!land || !water || !park || !road || !accent || !text || !route) continue;
      // The tint is see-through (accent over transparent): over land it is a mix of the two.
      const tintShare = /^color-mix\(in srgb, var\(--accent\) (\d+)%, transparent\)$/.exec(root['--map-tint']);
      expect(tintShare, '--map-tint').not.toBeNull();
      const tint = accent.map((v, i) => v * (Number(tintShare![1]) / 100) + land[i] * (1 - Number(tintShare![1]) / 100));
      // Rivers are a step deeper than the land, roads a step lighter (Imhof's few, quiet layers).
      expect(contrast(water, land), `${selector} water`).toBeGreaterThanOrEqual(1.1);
      expect(contrast(road, land), `${selector} road`).toBeGreaterThanOrEqual(1.08);
      // A park differs in hue more than in lightness: it is checked as a colour distance.
      expect(Math.hypot(...park.map((v, i) => v - land[i])), `${selector} park`).toBeGreaterThanOrEqual(12);
      // The 읍면동 tint is faint — a smaller step over the land than the land is over the page — and names keep their contrast on it.
      const surface = get('--surface')!;
      expect(contrast(tint, land), `${selector} tint`).toBeLessThan(contrast(land, surface));
      for (const ground of [land, tint, water]) {
        expect(contrast(text, ground), `${selector} name`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(route, water), `${selector} route on water`).toBeGreaterThanOrEqual(Math.min(contrast(route, land) * 0.7, 3));
      checked.push(selector);
    }
    expect(checked.length).toBeGreaterThan(10);
  });
});
