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

/** The square the pings and lines are laid out in, centred in the photo with a little air at its sides. */
export const DRAWING_BOX = (() => {
  const { photo } = POLAROID;
  const size = Math.round(photo.w * 0.9);
  return { x: photo.x + (photo.w - size) / 2, y: photo.y + Math.round((photo.h - size) / 2), size };
})();

/** The title strip under the photo. */
export const STRIP = { y: POLAROID.photo.y + POLAROID.photo.h, h: POLAROID.h - POLAROID.photo.y - POLAROID.photo.h } as const;

/**
 * The share image: two polaroids lying on a backdrop, a little askew, the
 * front one (with the photo) over a blank one behind. The whole of it, the
 * backdrop's margin included, is the 꾸미기 area and the saved image.
 */
export const SCENE = { w: 1400, h: 2000 } as const;

/** Where a card lies on the scene: its centre and its turn (degrees, clockwise). */
export interface CardPose {
  cx: number;
  cy: number;
  angle: number;
}

export const FRONT_CARD: CardPose = { cx: 690, cy: 1010, angle: -3 };
export const BACK_CARD: CardPose = { cx: 730, cy: 985, angle: 4 };

/** A point on a card (card pixels) to the scene, as the card lies at `pose`. */
export function cardToScene(pose: CardPose, x: number, y: number): { x: number; y: number } {
  const t = (pose.angle * Math.PI) / 180;
  const dx = x - POLAROID.w / 2;
  const dy = y - POLAROID.h / 2;
  return { x: pose.cx + dx * Math.cos(t) - dy * Math.sin(t), y: pose.cy + dx * Math.sin(t) + dy * Math.cos(t) };
}
