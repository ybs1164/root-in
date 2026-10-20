let pixel: CanvasRenderingContext2D | null | undefined;

/**
 * A colour token as the browser resolves it, as `rgb()`/`rgba()`. The map
 * tokens are mixes of other tokens (color-mix over var()), which a canvas or
 * a map SDK cannot read as written: the custom property's own value is still
 * that text, and even resolved, a mix is given back as `color(srgb …)`, which
 * MapLibre and Kakao don't parse — so it is painted on one pixel and read back.
 * Empty when the token is missing (or there is no document, in tests).
 */
export function resolvedColour(name: string): string {
  if (typeof document === 'undefined' || !document.body) return '';
  if (!getComputedStyle(document.documentElement).getPropertyValue(name).trim()) return '';
  const probe = document.createElement('span');
  probe.style.color = `var(${name})`;
  document.body.appendChild(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  if (pixel === undefined) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      pixel = canvas.getContext('2d', { willReadFrequently: true });
    } catch {
      pixel = null;
    }
  }
  if (!pixel || !colour) return colour;
  pixel.clearRect(0, 0, 1, 1);
  pixel.fillStyle = colour;
  pixel.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`;
}

/** `resolvedColour`, or `fallback` when the token gives nothing. */
export const colourToken = (name: string, fallback: string): string => resolvedColour(name) || fallback;
