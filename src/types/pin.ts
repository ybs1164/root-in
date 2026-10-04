import type { PlaceRef } from './course';

// Category icons, by name (the label is for screen readers). The shapes are
// solid vector glyphs in lib/pinGlyphs.ts, shared by React UI and the
// plain-DOM map markers.
export const PIN_ICONS = {
  cafe: '카페',
  food: '식당',
  bar: '술',
  photo: '사진',
  shop: '쇼핑',
  stay: '숙소',
  nature: '자연',
  culture: '문화',
  star: '별',
  heart: '하트',
  flag: '깃발',
  pin: '핀',
} as const;

export type PinIcon = keyof typeof PIN_ICONS;

/** Index into the fixed `--pin-1 … --pin-8` palette (independent of the design theme). */
export type PinColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const PIN_COLORS: PinColor[] = [1, 2, 3, 4, 5, 6, 7, 8];
/** What a pin is drawn in: a palette colour, or 0 for 미분류 (`--pin-0`, the theme's accent). */
export type PinTint = PinColor | 0;

export interface PinCategory {
  id: string;
  name: string;
  icon: PinIcon;
  color: PinColor;
  /** Set on a sub-category. Only two levels: a parent never has a parent. */
  parentId?: string;
  order: number;
}

export interface Pin {
  id: string;
  userId: string;
  /** Snapshot, so a pin still renders if the provider's data changes. */
  place: PlaceRef;
  categoryId: string;
  memo?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Self-contained snapshot carried by a `#pins=…` link. */
export interface SharedPinSet {
  title: string;
  categories: SharedPinCategory[];
  pins: SharedPin[];
  sharedBy?: string;
  sharedAt: string;
}

export interface SharedPinCategory {
  name: string;
  icon: PinIcon;
  color: PinColor;
  /** Index of the parent in `categories`. */
  parent?: number;
}

export interface SharedPin {
  place: PlaceRef;
  /** Index into `categories`. */
  category: number;
  memo?: string;
}
