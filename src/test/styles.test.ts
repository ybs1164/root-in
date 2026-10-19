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

  it("the 미니맵's land stays quiet: the route line keeps most of its contrast on it, in every theme", () => {
    const blocks = tokenBlocks(styles).map(([, selector, body]) => ({
      selector: selector.trim(),
      tokens: Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])),
    }));
    // The plain :root tokens are spread over several blocks.
    const root: Record<string, string> = Object.assign({}, ...blocks.filter((b) => b.selector === ':root').map((b) => b.tokens));
    const share = /color-mix\(in srgb, var\(--accent\) (\d+)%, var\(--surface\)\)/.exec(root['--mini-land']);
    expect(share).not.toBeNull();
    const mix = Number(share![1]) / 100;

    const hex = (v: string): number[] | null => (/^#[0-9a-f]{6}$/i.test(v) ? [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) : null);
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: number[], b: number[]) => {
      const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };

    const checked: string[] = [];
    for (const { selector, tokens } of blocks) {
      if (!tokens['--accent']) continue;
      const get = (name: string) => hex(tokens[name] ?? root[name] ?? '');
      const [accent, surface, route] = [get('--accent'), get('--surface'), get(tokens['--route'] === 'var(--accent)' ? '--accent' : '--route')];
      if (!accent || !surface || !route) continue;
      const land = accent.map((v, i) => v * mix + surface[i] * (1 - mix));
      // Most of the line's contrast with the page is kept on land (or it stays plainly readable, as on 모노's black).
      expect(contrast(route, land), selector).toBeGreaterThanOrEqual(Math.min(contrast(route, surface) * 0.75, 4.5));
      // …while the land still shows against the page.
      expect(contrast(land, surface), selector).toBeGreaterThanOrEqual(1.08);
      checked.push(selector);
    }
    expect(checked.length).toBeGreaterThan(10);
  });
});
