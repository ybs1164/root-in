import { PIN_GLYPHS } from '../lib/pinGlyphs';
import type { PinIcon } from '../types/pin';

/** A pin category's solid icon, in the current text colour (the map markers use the same shapes). */
export default function PinGlyph({ icon }: { icon: PinIcon }) {
  return (
    <svg
      className="pin-glyph"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable="false"
      // Static, trusted markup from PIN_GLYPHS (shared with the map markers).
      dangerouslySetInnerHTML={{ __html: PIN_GLYPHS[icon] }}
    />
  );
}
