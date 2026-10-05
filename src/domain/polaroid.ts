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
 * The share image: polaroids lying on a backdrop (how, the card's layout).
 * The whole of it, the backdrop's margin included, is the 꾸미기 area and
 * the saved image.
 */
export const SCENE = { w: 1400, h: 2000 } as const;

/** Where a card lies on the scene: its centre, its turn (degrees, clockwise) and its size (1 = POLAROID). */
export interface CardPose {
  cx: number;
  cy: number;
  angle: number;
  scale?: number;
}

/** 두 장: the first layout, the photo card over a blank one, both askew. */
export const FRONT_CARD: CardPose = { cx: 690, cy: 1010, angle: -3 };
export const BACK_CARD: CardPose = { cx: 730, cy: 985, angle: 4 };

/**
 * How the polaroid lies on the share image (the 꾸미기 screen's 폴라로이드
 * button), after the share card mock: 탑승권 (a smaller card with a boarding
 * pass under it — the default), 두 장, 한 장 반듯하게 on a faint grid,
 * 테이프 on paper, 지도 위 on an illustrated map, and 노트 clipped to a lined
 * page with the date in hand under it.
 */
export type PolaroidLayout = 'ticket' | 'stack' | 'single' | 'tape' | 'map' | 'notebook';

export const POLAROID_LAYOUTS: { id: PolaroidLayout; label: string }[] = [
  { id: 'ticket', label: '탑승권' },
  { id: 'stack', label: '두 장' },
  { id: 'single', label: '한 장' },
  { id: 'tape', label: '테이프' },
  { id: 'map', label: '지도' },
  { id: 'notebook', label: '노트' },
];

export const DEFAULT_LAYOUT: PolaroidLayout = 'ticket';

export const isPolaroidLayout = (v: unknown): v is PolaroidLayout => POLAROID_LAYOUTS.some((l) => l.id === v);

/** The photo card's pose in each layout, and the blank one behind it where there is one. */
export const LAYOUT_CARDS: Record<PolaroidLayout, { front: CardPose; back?: CardPose }> = {
  ticket: { front: { cx: 590, cy: 790, angle: -3, scale: 0.7 } },
  stack: { front: FRONT_CARD, back: BACK_CARD },
  single: { front: { cx: 700, cy: 930, angle: 0, scale: 0.74 } },
  tape: { front: { cx: 700, cy: 1010, angle: -2, scale: 0.88 } },
  map: { front: { cx: 700, cy: 960, angle: 4, scale: 0.76 } },
  notebook: { front: { cx: 730, cy: 870, angle: 3, scale: 0.72 } },
};

/** 탑승권: the boarding pass under the card (its centre, turn and size on the scene). */
export const TICKET = { cx: 820, cy: 1640, angle: 5, w: 820, h: 300, stub: 220 } as const;

/** A point on a card (card pixels) to the scene, as the card lies at `pose`. */
export function cardToScene(pose: CardPose, x: number, y: number): { x: number; y: number } {
  const t = (pose.angle * Math.PI) / 180;
  const k = pose.scale ?? 1;
  const dx = (x - POLAROID.w / 2) * k;
  const dy = (y - POLAROID.h / 2) * k;
  return { x: pose.cx + dx * Math.cos(t) - dy * Math.sin(t), y: pose.cy + dx * Math.sin(t) + dy * Math.cos(t) };
}

/** A scene point back to a card's own pixels (cardToScene's inverse). */
export function sceneToCard(pose: CardPose, x: number, y: number): { x: number; y: number } {
  const t = (pose.angle * Math.PI) / 180;
  const k = pose.scale ?? 1;
  const dx = x - pose.cx;
  const dy = y - pose.cy;
  return { x: POLAROID.w / 2 + (dx * Math.cos(t) + dy * Math.sin(t)) / k, y: POLAROID.h / 2 + (-dx * Math.sin(t) + dy * Math.cos(t)) / k };
}
