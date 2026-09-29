import type { PlaceRef } from './course';

// Emoji keep the icon identical in React UI and in the plain-DOM map markers
// (both map providers render markers outside React).
export const PIN_ICONS = {
  cafe: '☕',
  food: '🍽️',
  bar: '🍷',
  photo: '📷',
  shop: '🛍️',
  stay: '🛏️',
  nature: '🌳',
  culture: '🏛️',
  star: '⭐',
  heart: '❤️',
  flag: '🚩',
  pin: '📍',
} as const;

export type PinIcon = keyof typeof PIN_ICONS;

/** Index into the fixed `--pin-1 … --pin-8` palette (independent of the design theme). */
export type PinColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const PIN_COLORS: PinColor[] = [1, 2, 3, 4, 5, 6, 7, 8];

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
