import artwork from '../assets/category-icons.svg?raw';
import type { EXTRA_PIN_ICONS } from '../types/categoryIcons';

/** Trusted, bundled SVG artwork: the same image fragments feed React and both map providers. */
export const EXTRA_PIN_GLYPHS = Object.fromEntries(
  [...artwork.matchAll(/<symbol id="([^"]+)"[^>]*>([\s\S]*?)<\/symbol>/g)].map((match) => [match[1], match[2]]),
) as Record<keyof typeof EXTRA_PIN_ICONS, string>;
