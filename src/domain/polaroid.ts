/**
 * The share image is a polaroid: a white card with the photo near the top
 * and a wide strip under it for the title. Proportions follow the reference
 * card (434 × 676 px: photo inset 24 at the sides and 23 at the top, 386 ×
 * 532, strip 121), scaled to 1080 wide.
 */
export const POLAROID = {
  w: 1080,
  h: 1682,
  photo: { x: 60, y: 57, w: 960, h: 1324 },
} as const;

/**
 * The square the pings and lines are laid out in (and the 꾸미기 pieces are
 * measured against), centred in the photo with a little air at its sides.
 */
export const DRAWING_BOX = (() => {
  const { photo } = POLAROID;
  const size = Math.round(photo.w * 0.9);
  return { x: photo.x + (photo.w - size) / 2, y: photo.y + Math.round((photo.h - size) / 2), size };
})();

/** The title strip under the photo. */
export const STRIP = { y: POLAROID.photo.y + POLAROID.photo.h, h: POLAROID.h - POLAROID.photo.y - POLAROID.photo.h } as const;

/** A rect on the card as percentages of the card, for laying DOM over the image. */
export function cardPercent(r: { x: number; y: number; w: number; h: number }) {
  return {
    left: `${(r.x / POLAROID.w) * 100}%`,
    top: `${(r.y / POLAROID.h) * 100}%`,
    width: `${(r.w / POLAROID.w) * 100}%`,
    height: `${(r.h / POLAROID.h) * 100}%`,
  };
}
