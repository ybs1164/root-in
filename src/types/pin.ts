import type { PlaceRef } from './course';
import { EXTRA_PIN_ICONS } from './categoryIcons';

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
  ...EXTRA_PIN_ICONS,
} as const;

export type PinIcon = keyof typeof PIN_ICONS;

/** Index into the fixed `--pin-1 … --pin-8` palette (independent of the design theme). */
export type PinPaletteColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const PIN_COLORS: PinPaletteColor[] = [1, 2, 3, 4, 5, 6, 7, 8];
/**
 * A category's colour: a palette entry, or a lowercase `#rrggbb` picked from
 * the colour wheel (the form's rainbow button, which took the grey's place).
 */
export type PinColor = PinPaletteColor | `#${string}`;
/** What a pin is drawn in: a palette colour, or 0 for 미분류 (`--pin-0`, the theme's accent). */
export type PinTint = PinColor | 0;

export interface PinCategory {
  id: string;
  name: string;
  icon: PinIcon;
  color: PinColor;
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
}

export interface SharedPin {
  place: PlaceRef;
  /** Index into `categories`. */
  category: number;
  memo?: string;
}
