import type { PlaceRef } from '../types/course';
import type { Pin, PinCategory, SharedPinCategory } from '../types/pin';
import { addCategory, PIN_LIMITS, updateCategory } from './pin';
import { withoutExcluded, type ExcludedPlace } from './privacy';

// 카테고리 구독: a category shared by link (#c=<slug>). The owner's phone
// publishes what's in it (without 제외 주소 places) whenever it changes; a
// subscriber's phone reads that and keeps a category of its own in step —
// ordinary pins and an ordinary category, so the map, rail and cards need
// nothing new.

export interface SharedPlace {
  place: PlaceRef;
  memo?: string;
}

/** What a shared category's link serves: its look and its places, oldest first. */
export interface CategorySnapshot {
  category: SharedPinCategory;
  places: SharedPlace[];
}

/** A category I follow, kept on this device. */
export interface CategorySubscription {
  slug: string;
  /** My category the places land in. */
  categoryId: string;
  /** The sharer's nickname when last read. */
  owner: string;
  /** The owner's look when last read: mine follows only when theirs changes, so a rename of my own stays until then. */
  look: SharedPinCategory;
  /** Places this subscription put in (place ids). Only these are updated or taken out again. */
  added: string[];
}

export interface PinState {
  pins: Pin[];
  categories: PinCategory[];
}

/** What the owner publishes for `category`; places on an excluded address are left out. */
export function categorySnapshot(
  category: PinCategory,
  pins: Pin[],
  excluded: ExcludedPlace[],
): { snapshot: CategorySnapshot; removed: number } {
  const mine = pins.filter((p) => p.categoryId === category.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const cut = withoutExcluded(mine, (p) => p.place, excluded);
  return {
    snapshot: {
      category: { name: category.name, icon: category.icon, color: category.color },
      places: cut.kept.slice(0, PIN_LIMITS.maxPins).map((p) => (p.memo ? { place: p.place, memo: p.memo } : { place: p.place })),
    },
    removed: cut.removed,
  };
}

const sameLook = (a: SharedPinCategory, b: SharedPinCategory) => a.name === b.name && a.icon === b.icon && a.color === b.color;

// Only what a snapshot carries: a pin's own extra fields (provider ids…) don't count as a change.
const samePlace = (a: PlaceRef, b: PlaceRef) =>
  a.name === b.name &&
  (a.address ?? '') === (b.address ?? '') &&
  (a.kind ?? '') === (b.kind ?? '') &&
  a.center[0] === b.center[0] &&
  a.center[1] === b.center[1];

/**
 * Brings my copy of a followed category in step with the owner's snapshot:
 * new places are pinned, places the owner took out go (if this subscription
 * put them in and they're still in the category), names and memos follow.
 * A place I had pinned already stays as I filed it; a pin I moved to another
 * category is mine from then on. `gone`: I deleted the category, so the
 * subscription ends.
 */
export function followCategory(
  state: PinState,
  sub: CategorySubscription,
  snapshot: CategorySnapshot,
  makePin: () => Pick<Pin, 'id' | 'userId' | 'createdAt'>,
): { gone: true } | { gone: false; state: PinState; sub: CategorySubscription; changed: boolean } {
  if (!state.categories.some((c) => c.id === sub.categoryId)) return { gone: true };
  const categories = sameLook(sub.look, snapshot.category)
    ? state.categories
    : updateCategory(state.categories, sub.categoryId, snapshot.category);
  const want = new Map(snapshot.places.map((p) => [p.place.id, p]));
  const inCategory = (pin: Pin) => pin.categoryId === sub.categoryId;
  const added = new Set(sub.added.filter((id) => state.pins.some((p) => p.place.id === id && inCategory(p))));

  const now = new Date().toISOString();
  let pins = state.pins.filter((p) => !(added.has(p.place.id) && inCategory(p) && !want.has(p.place.id)));
  for (const id of added) if (!want.has(id)) added.delete(id);
  pins = pins.map((p) => {
    const next = added.has(p.place.id) && inCategory(p) ? want.get(p.place.id) : undefined;
    if (!next || (samePlace(p.place, next.place) && (p.memo ?? '') === (next.memo ?? ''))) return p;
    const pin: Pin = { ...p, place: { ...p.place, ...next.place }, updatedAt: now };
    if (next.memo) pin.memo = next.memo;
    else delete pin.memo;
    return pin;
  });
  for (const next of snapshot.places) {
    if (pins.some((p) => p.place.id === next.place.id)) continue;
    if (pins.length >= PIN_LIMITS.maxPins) break;
    const pin: Pin = { ...makePin(), place: next.place, categoryId: sub.categoryId };
    if (next.memo) pin.memo = next.memo;
    pins.push(pin);
    added.add(next.place.id);
  }

  const nextAdded = [...added];
  const changed =
    pins.length !== state.pins.length || pins.some((p, i) => p !== state.pins[i]) || categories !== state.categories;
  const subChanged = changed || !sameLook(sub.look, snapshot.category) || nextAdded.join() !== sub.added.join();
  return {
    gone: false,
    state: { pins, categories },
    sub: subChanged ? { ...sub, look: snapshot.category, added: nextAdded } : sub,
    changed,
  };
}

/** 구독: a new category of mine in the owner's look, filled with their places. */
export function subscribeCategory(
  state: PinState,
  slug: string,
  owner: string,
  snapshot: CategorySnapshot,
  makeCategoryId: () => string,
  makePin: () => Pick<Pin, 'id' | 'userId' | 'createdAt'>,
): { problem: 'too-many' } | { state: PinState; sub: CategorySubscription } {
  const made = addCategory(state.categories, snapshot.category, makeCategoryId);
  if ('problem' in made) return { problem: 'too-many' };
  const sub: CategorySubscription = { slug, categoryId: made.category.id, owner, look: snapshot.category, added: [] };
  const followed = followCategory({ pins: state.pins, categories: made.categories }, sub, snapshot, makePin);
  if (followed.gone) return { problem: 'too-many' }; // can't happen: the category was just made
  return { state: followed.state, sub: followed.sub };
}
