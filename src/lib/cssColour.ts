let pixel: CanvasRenderingContext2D | null | undefined;

const rgbText = (r: number, g: number, b: number, a: number) =>
  a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+a.toFixed(3)})`;

/**
 * A computed colour as `rgb()`/`rgba()` when it can be read as text: Chrome
 * writes a mix as `color(srgb r g b / a)` (channels 0..1), which MapLibre and
 * Kakao don't parse. Null for anything else.
 */
export function rgbOf(colour: string): string | null {
  if (/^rgba?\(/.test(colour)) return colour;
  const srgb = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)$/.exec(colour);
  if (!srgb) return null;
  const [r, g, b] = srgb.slice(1, 4).map((v) => Math.round(Math.min(1, Math.max(0, Number(v))) * 255));
  return rgbText(r, g, b, srgb[4] === undefined ? 1 : Number(srgb[4]));
}

/**
 * A colour token as the browser resolves it, as `rgb()`/`rgba()`. The map
 * tokens are mixes of other tokens (color-mix over var()), which a canvas or
 * a map SDK cannot read as written: the custom property's own value is still
 * that text. Resolved, it is read as text (`rgbOf`) — exactly, which matters
 * for a see-through colour; anything else is painted on one pixel and read
 * back. Empty when the token is missing (or there is no document, in tests).
 */
export function resolvedColour(name: string): string {
  if (typeof document === 'undefined' || !document.body) return '';
  if (!getComputedStyle(document.documentElement).getPropertyValue(name).trim()) return '';
  const probe = document.createElement('span');
  probe.style.color = `var(${name})`;
  document.body.appendChild(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  const read = rgbOf(colour);
  if (read || !colour) return read ?? colour;
  if (pixel === undefined) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      pixel = canvas.getContext('2d', { willReadFrequently: true });
    } catch {
      pixel = null;
    }
  }
  if (!pixel) return colour;
  pixel.clearRect(0, 0, 1, 1);
  pixel.fillStyle = colour;
  pixel.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
  return rgbText(r, g, b, a / 255);
}

/** `resolvedColour`, or `fallback` when the token gives nothing. */
export const colourToken = (name: string, fallback: string): string => resolvedColour(name) || fallback;

/** An `rgb()`/`rgba()` colour as a solid colour and its opacity. */
export function splitAlpha(colour: string): { colour: string; alpha: number } {
  const rgba = /^rgba\((\d+), ?(\d+), ?(\d+), ?([\d.]+)\)$/.exec(colour);
  return rgba ? { colour: `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`, alpha: Number(rgba[4]) } : { colour, alpha: 1 };
}

/**
 * A token as a solid colour and its opacity, for SDKs that take the two
 * apart (Kakao's fillColor and fillOpacity).
 */
export function colourAlpha(name: string, fallback: string, fallbackAlpha = 1): { colour: string; alpha: number } {
  const resolved = resolvedColour(name);
  return resolved ? splitAlpha(resolved) : { colour: fallback, alpha: fallbackAlpha };
}
