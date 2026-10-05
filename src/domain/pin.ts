import type { PlaceRef } from '../types/course';
import {
  PIN_ICONS,
  type Pin,
  type PinCategory,
  type PinColor,
  type PinPaletteColor,
  type PinIcon,
  type PinTint,
  type SharedPin,
  type SharedPinCategory,
  type SharedPinSet,
} from '../types/pin';

export const PIN_LIMITS = {
  // localStorage is ~5MB per origin; this keeps pins well under it.
  maxPins: 500,
  maxCategories: 30,
  categoryName: 12,
  memo: 120,
  /** A pin's place name, as renamed from its card. */
  name: 40,
} as const;

/** Pins whose category was deleted land here; it is never stored. */
export const UNCATEGORIZED: PinCategory = { id: 'none', name: '미분류', icon: 'pin', color: 8, order: 9999 };

export const DEFAULT_CATEGORIES: PinCategory[] = [
  { id: 'cafe', name: '카페', icon: 'cafe', color: 1, order: 0 },
  { id: 'food', name: '맛집', icon: 'food', color: 2, order: 1 },
  { id: 'bar', name: '술집', icon: 'bar', color: 3, order: 2 },
  { id: 'photo', name: '사진 명소', icon: 'photo', color: 4, order: 3 },
  { id: 'shop', name: '쇼핑', icon: 'shop', color: 5, order: 4 },
  { id: 'togo', name: '가볼 곳', icon: 'flag', color: 6, order: 5 },
];

export const isPinIcon = (value: unknown): value is PinIcon => typeof value === 'string' && value in PIN_ICONS;
export const isPinColor = (value: unknown): value is PinColor =>
  (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 8) ||
  (typeof value === 'string' && /^#[0-9a-f]{6}$/.test(value));

/**
 * The category form's seven swatches: the palette without its grey (8), whose
 * place is the rainbow button. Old categories in grey keep drawing in it.
 */
export const PIN_SWATCHES: PinPaletteColor[] = [1, 2, 3, 4, 5, 6, 7];

/** CSS for a pin colour: palette entries (and 미분류's 0) by token, wheel picks as they are. */
export const pinColorCss = (color: PinTint): string => (typeof color === 'string' ? color : `var(--pin-${color})`);

const byOrder = (a: PinCategory, b: PinCategory) => a.order - b.order || a.name.localeCompare(b.name);

/**
 * Categories saved before sub-categories were dropped (2026-10-04) may carry
 * a `parentId`: each sub-category becomes a category of its own, listed
 * right after its old parent, keeping its colour and the parent's icon it
 * was drawn with.
 */
export function flattenLegacyCategories(stored: (PinCategory & { parentId?: string })[]): PinCategory[] {
  const parents = stored.filter((c) => !c.parentId || !stored.some((p) => p.id === c.parentId)).sort(byOrder);
  const flat: PinCategory[] = [];
  for (const parent of parents) {
    flat.push(parent);
    const children = stored.filter((c) => c.parentId === parent.id && c.id !== parent.id).sort(byOrder);
    flat.push(...children.map((c) => ({ ...c, icon: parent.icon })));
  }
  // Anything malformed (deeper than two levels) still keeps its pins.
  flat.push(...stored.filter((c) => !flat.some((f) => f.id === c.id)));
  return flat.map(({ id, name, icon, color }, order) => ({ id, name, icon, color, order }));
}

export function findCategory(categories: PinCategory[], id: string): PinCategory {
  return categories.find((c) => c.id === id) ?? UNCATEGORIZED;
}

/** A pin's category is 미분류: filed there, or under a category that no longer exists. */
export function isUncategorized(categories: PinCategory[], id: string): boolean {
  return !categories.some((c) => c.id === id);
}

/** A category's look; 미분류 is the plain pin in the theme's accent (`--pin-0`). */
export function categoryStyle(categories: PinCategory[], id: string): { icon: PinIcon; color: PinTint } {
  if (isUncategorized(categories, id)) return { icon: 'pin', color: 0 };
  const category = findCategory(categories, id);
  return { icon: category.icon, color: category.color };
}

/** In order: the shape every list renders. */
export function orderedCategories(categories: PinCategory[]): PinCategory[] {
  return [...categories].sort(byOrder);
}

/** 미분류 first (it can't be deleted or moved), then the categories in order: what pickers and the rail list. */
export function categoriesWithUncategorized(categories: PinCategory[]): PinCategory[] {
  return [UNCATEGORIZED, ...orderedCategories(categories)];
}

export type CategoryProblem = 'empty-name' | 'too-many';

export interface NewCategoryInput {
  name: string;
  icon?: PinIcon;
  color?: PinColor;
}

/** Adds a category; returns the problem instead when it isn't allowed. */
export function addCategory(
  categories: PinCategory[],
  input: NewCategoryInput,
  makeId: () => string,
): { categories: PinCategory[]; category: PinCategory } | { problem: CategoryProblem } {
  const name = input.name.trim().slice(0, PIN_LIMITS.categoryName);
  if (!name) return { problem: 'empty-name' };
  if (categories.length >= PIN_LIMITS.maxCategories) return { problem: 'too-many' };
  const category: PinCategory = {
    id: makeId(),
    name,
    icon: input.icon ?? 'pin',
    color: input.color ?? 7,
    order: categories.reduce((max, c) => Math.max(max, c.order + 1), 0),
  };
  return { categories: [...categories, category], category };
}

export function updateCategory(
  categories: PinCategory[],
  id: string,
  patch: Partial<Pick<PinCategory, 'name' | 'icon' | 'color'>>,
): PinCategory[] {
  return categories.map((c) => {
    if (c.id !== id) return c;
    const name = patch.name === undefined ? c.name : patch.name.slice(0, PIN_LIMITS.categoryName);
    return { ...c, ...patch, name };
  });
}

/** Swaps with the previous/next category. */
export function moveCategory(categories: PinCategory[], id: string, direction: -1 | 1): PinCategory[] {
  const ordered = orderedCategories(categories);
  const index = ordered.findIndex((c) => c.id === id);
  if (index === -1 || !ordered[index + direction]) return categories;
  return placeCategory(categories, id, index + direction);
}

/** Puts a category at `to` in the order (a drag in the editor). */
export function placeCategory(categories: PinCategory[], id: string, to: number): PinCategory[] {
  const ordered = orderedCategories(categories);
  const from = ordered.findIndex((c) => c.id === id);
  if (from === -1) return categories;
  const index = Math.max(0, Math.min(ordered.length - 1, Math.round(to)));
  if (index === from) return categories;
  const [target] = ordered.splice(from, 1);
  ordered.splice(index, 0, target);
  // Renumber so equal/missing orders can't make the move a no-op.
  const order = new Map(ordered.map((c, i) => [c.id, i]));
  return categories.map((c) => ({ ...c, order: order.get(c.id) as number }));
}

/** Deletes a category without deleting pins: its pins become 미분류. */
export function removeCategory(
  categories: PinCategory[],
  pins: Pin[],
  id: string,
): { categories: PinCategory[]; pins: Pin[] } {
  if (!categories.some((c) => c.id === id)) return { categories, pins };
  return {
    categories: categories.filter((c) => c.id !== id),
    pins: pins.map((p) => (p.categoryId === id ? { ...p, categoryId: UNCATEGORIZED.id } : p)),
  };
}

/**
 * One pin per place: pinning a place again re-files the existing pin under
 * the new category instead of stacking a duplicate marker.
 */
export function upsertPin(
  pins: Pin[],
  input: { place: PlaceRef; categoryId: string; memo?: string },
  make: () => Pick<Pin, 'id' | 'userId' | 'createdAt'>,
): { pins: Pin[]; pin: Pin; existed: boolean } | { problem: 'too-many' } {
  const existing = pins.find((p) => p.place.id === input.place.id);
  if (existing) {
    const pin: Pin = { ...existing, categoryId: input.categoryId, updatedAt: new Date().toISOString() };
    if (input.memo !== undefined) pin.memo = input.memo;
    return { pins: pins.map((p) => (p.id === pin.id ? pin : p)), pin, existed: true };
  }
  if (pins.length >= PIN_LIMITS.maxPins) return { problem: 'too-many' };
  const pin: Pin = { ...make(), place: input.place, categoryId: input.categoryId };
  const memo = input.memo?.trim().slice(0, PIN_LIMITS.memo);
  if (memo) pin.memo = memo;
  return { pins: [...pins, pin], pin, existed: false };
}

/** Pins shown for a filter (null = all), newest first. */
export function filterPins(pins: Pin[], categories: PinCategory[], filter: string | null): Pin[] {
  return pins
    .filter((p) => !filter || p.categoryId === filter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * The map rail's filter: any number of categories picked at once. Nothing
 * picked shows every pin.
 */
export function filterPinsByCategories(pins: Pin[], categories: PinCategory[], picked: ReadonlySet<string>): Pin[] {
  // Only categories that still exist (and 미분류) count: none of those picked is ALL, every pin.
  const live = [...picked].filter((id) => id === UNCATEGORIZED.id || categories.some((c) => c.id === id));
  if (live.length === 0) return filterPins(pins, categories, null);
  const shown = new Set(live);
  const loose = live.includes(UNCATEGORIZED.id);
  return filterPins(pins, categories, null).filter((p) => shown.has(p.categoryId) || (loose && isUncategorized(categories, p.categoryId)));
}

// ----- Pin sets (sharing) -----

export const PIN_SET_LIMITS = { maxPins: 30, title: 40 } as const;

/**
 * Snapshot of `pins` for a `#pins=` link, carrying only the categories they
 * use.
 */
export function buildPinSet(
  title: string,
  pins: Pin[],
  categories: PinCategory[],
  sharedBy?: string,
): { set: SharedPinSet; dropped: number } {
  const chosen = pins.slice(0, PIN_SET_LIMITS.maxPins);
  const used = new Set<string>();
  for (const pin of chosen) used.add(findCategory(categories, pin.categoryId).id);
  const ordered = orderedCategories([...categories, UNCATEGORIZED]).filter((c) => used.has(c.id));
  const index = new Map(ordered.map((c, i) => [c.id, i]));
  const set: SharedPinSet = {
    title: title.trim().slice(0, PIN_SET_LIMITS.title) || '핀 모음',
    categories: ordered.map((c): SharedPinCategory => ({ name: c.name, icon: c.icon, color: c.color })),
    pins: chosen.map((p) => {
      const out: SharedPin = { place: p.place, category: index.get(findCategory(categories, p.categoryId).id) ?? 0 };
      if (p.memo) out.memo = p.memo;
      return out;
    }),
    sharedAt: new Date().toISOString(),
  };
  if (sharedBy?.trim()) set.sharedBy = sharedBy.trim();
  return { set, dropped: pins.length - chosen.length };
}

/**
 * Saves a received pin set into my pins: categories are matched by name
 * and created when missing; pins are upserted by place.
 * When my category list is full, the rest land in 미분류.
 */
export function importPinSet(
  categories: PinCategory[],
  pins: Pin[],
  set: SharedPinSet,
  makeId: () => string,
  makePin: () => Pick<Pin, 'id' | 'userId' | 'createdAt'>,
): { categories: PinCategory[]; pins: Pin[]; added: number } {
  let nextCategories = categories;
  const resolved: string[] = [];
  set.categories.forEach((incoming, i) => {
    if (incoming.name === UNCATEGORIZED.name) return (resolved[i] = UNCATEGORIZED.id);
    const match = nextCategories.find((c) => c.name === incoming.name);
    if (match) return (resolved[i] = match.id);
    const result = addCategory(nextCategories, { name: incoming.name, icon: incoming.icon, color: incoming.color }, makeId);
    if ('problem' in result) return (resolved[i] = UNCATEGORIZED.id);
    nextCategories = result.categories;
    resolved[i] = result.category.id;
  });

  let nextPins = pins;
  let added = 0;
  for (const shared of set.pins) {
    const result = upsertPin(
      nextPins,
      { place: shared.place, categoryId: resolved[shared.category] ?? UNCATEGORIZED.id, memo: shared.memo },
      makePin,
    );
    if ('problem' in result) break;
    nextPins = result.pins;
    if (!result.existed) added += 1;
  }
  return { categories: nextCategories, pins: nextPins, added };
}
