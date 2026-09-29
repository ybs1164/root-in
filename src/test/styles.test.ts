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
});
