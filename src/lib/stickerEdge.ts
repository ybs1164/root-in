/**
 * A sticker's white die-cut edge, for canvases (the share image, the peel).
 * On screen the same edge is CSS drop-shadows (`.decor__sticker img`); both
 * scale it with the sticker so a big one isn't thin-edged and a small one
 * isn't all edge.
 */

/**
 * A sticker's edge, as a share of the sticker's own width — on the sheet, in
 * the hand, stuck on a drawing, a photo or a group's board, and in the share
 * image. Tied to the drawing's width instead (2026-11-02), a sticker shrunk
 * to fit a zoomed-in board wore an edge a tenth of its width (2026-11-22).
 */
export const STICKER_EDGE_RATIO = 0.02;

/** The edge in px for a sticker `width` px wide; a hairline at least, so a tiny one keeps one. */
export const stickerEdgePx = (width: number): number => Math.max(0.6, width * STICKER_EDGE_RATIO);

/**
 * The picture drawn `size` px wide with an `edge` px border around its
 * shape in `color`: the shape stamped around itself in a ring, then the
 * picture on top. The canvas is `size + 2 * pad` wide, the picture inset by `pad`.
 */
export function outlinedSticker(img: CanvasImageSource, size: number, edge: number, color: string): { canvas: HTMLCanvasElement; pad: number } {
  const s = Math.max(1, Math.round(size));
  const pad = Math.ceil(edge) + 1;
  const px = s + pad * 2;
  const canvas = () => Object.assign(document.createElement('canvas'), { width: px, height: px });
  const shape = canvas();
  const sc = shape.getContext('2d')!;
  sc.drawImage(img, pad, pad, s, s);
  sc.globalCompositeOperation = 'source-in';
  sc.fillStyle = color;
  sc.fillRect(0, 0, px, px);
  const out = canvas();
  const oc = out.getContext('2d')!;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    oc.drawImage(shape, Math.cos(a) * edge, Math.sin(a) * edge);
  }
  oc.drawImage(img, pad, pad, s, s);
  return { canvas: out, pad };
}
