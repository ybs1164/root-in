import type { PinIcon } from '../types/pin';

/**
 * Pin category icons as solid vector shapes (24×24, `currentColor`), so one
 * set draws both in React UI and in the plain-DOM map markers (both map
 * providers render markers outside React). Filled rather than outlined: the
 * shapes read as a colour on the map and as a white cut-out on a coloured
 * button. Holes (a camera lens, a pin's dot) use the even-odd rule so they
 * show whatever is behind.
 */
export const PIN_GLYPHS: Record<PinIcon, string> = {
  cafe:
    '<path d="M3 6h14v2.5A6.5 6.5 0 0 1 10.5 15h-1A6.5 6.5 0 0 1 3 8.5z"/>' +
    '<path d="M17 7h1.5a3.5 3.5 0 0 1 0 7h-2.2l.9-2.2h1.3a1.3 1.3 0 0 0 0-2.6H17z"/>' +
    '<rect x="2" y="16" width="18" height="2" rx="1"/>',
  food:
    '<path d="M4.5 2h1.2v5h1.1V2H8v5h1.1V2h1.2v6.2a3 3 0 0 1-2 2.83V21a1.2 1.2 0 0 1-2.4 0V11.03a3 3 0 0 1-2-2.83z"/>' +
    '<path d="M17.4 2C19.6 3.6 20.6 6.4 20.6 9.6V14h-2.2v7a1.2 1.2 0 0 1-2.4 0V3.2A1.2 1.2 0 0 1 17.4 2z"/>',
  bar: '<path d="M6 2h12v5.5a6 6 0 0 1-4.8 5.88V19.6h3a1.2 1.2 0 0 1 0 2.4H7.8a1.2 1.2 0 0 1 0-2.4h3v-6.22A6 6 0 0 1 6 7.5z"/>',
  photo:
    '<path fill-rule="evenodd" d="M4.2 7h2.9l1.6-2.2a1.5 1.5 0 0 1 1.2-.6h4.2a1.5 1.5 0 0 1 1.2.6L16.9 7h2.9A2.2 2.2 0 0 1 22 9.2v8.6a2.2 2.2 0 0 1-2.2 2.2H4.2A2.2 2.2 0 0 1 2 17.8V9.2A2.2 2.2 0 0 1 4.2 7zM12 9.6a3.9 3.9 0 1 0 0 7.8 3.9 3.9 0 0 0 0-7.8z"/>',
  shop:
    '<path d="M4.6 8h14.8l-1.1 12.2a2 2 0 0 1-2 1.8H7.7a2 2 0 0 1-2-1.8z"/>' +
    '<path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  stay:
    '<path d="M2 5.2a1.2 1.2 0 0 1 2.4 0V14H22v6a1.2 1.2 0 0 1-2.4 0v-2.4H4.4V20A1.2 1.2 0 0 1 2 20z"/>' +
    '<rect x="5.6" y="9" width="5" height="3.8" rx="1.6"/>' +
    '<path d="M12 9h6.5a3.5 3.5 0 0 1 3.5 3.5v.3h-10z"/>',
  nature:
    '<path d="M12 1.5 18.5 10h-3.2l5.2 7H3.5l5.2-7H5.5z"/>' + '<rect x="10.6" y="16" width="2.8" height="6.5" rx="1.2"/>',
  culture:
    '<path d="M12 1.8 2 6.8V9h20V6.8z"/>' +
    '<rect x="4" y="10.5" width="2.6" height="8" rx=".6"/><rect x="8.8" y="10.5" width="2.6" height="8" rx=".6"/>' +
    '<rect x="12.6" y="10.5" width="2.6" height="8" rx=".6"/><rect x="17.4" y="10.5" width="2.6" height="8" rx=".6"/>' +
    '<rect x="2" y="19.6" width="20" height="2.6" rx="1"/>',
  star: '<path d="M12 1.8l3 6.4 7 .8-5.2 4.8 1.4 6.9L12 17.2l-6.2 3.5 1.4-6.9L2 9l7-.8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>',
  heart: '<path d="M12 21.2C6.4 17.3 2 13.5 2 8.6A5.4 5.4 0 0 1 12 5.6a5.4 5.4 0 0 1 10 3c0 4.9-4.4 8.7-10 12.6z"/>',
  flag:
    '<path d="M5.2 2a1.2 1.2 0 0 1 1.2 1.2V21a1.2 1.2 0 0 1-2.4 0V3.2A1.2 1.2 0 0 1 5.2 2z"/>' +
    '<path d="M7.6 3H20l-3.2 4.8L20 12.6H7.6z"/>',
  pin: '<path fill-rule="evenodd" d="M12 1.5a8.2 8.2 0 0 1 8.2 8.2c0 5.4-5.6 10.6-7.4 12.1a1.2 1.2 0 0 1-1.6 0C9.4 20.3 3.8 15.1 3.8 9.7A8.2 8.2 0 0 1 12 1.5zm0 5a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z"/>',
};

/** The icon as an `<svg>` string, for markers built outside React. */
export function pinGlyphSvg(icon: PinIcon, className = 'pin-glyph'): string {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${PIN_GLYPHS[icon]}</svg>`;
}
