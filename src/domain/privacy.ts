import { haversineMeters } from './geo';

/**
 * 개인 정보 → 제외 주소: places that must never go out in a share (home
 * first, and required). Anything shared within EXCLUDE_RADIUS_M of one —
 * or carrying the same address — is dropped when 공유 is pressed.
 */
export interface ExcludedPlace {
  id: string;
  /** '집' is the fixed first row; the rest are extra addresses. */
  kind: 'home' | 'other';
  /** An extra address's own name ('회사', '부모님 댁'…); 집 is always '집'. */
  name?: string;
  /** What the user typed. Empty until filled in. */
  address: string;
  /** Where the address was found (place search); missing if it couldn't be. */
  center?: [number, number];
}

export const PRIVACY_LIMITS = {
  address: 80,
  name: 10,
  /** 집 plus up to five more. */
  maxPlaces: 6,
} as const;

/** A shared place this close to an excluded address counts as that address (same building, its entrance, …). */
export const EXCLUDE_RADIUS_M = 150;

export const HOME_ID = 'home';

/** The list always starts with an (empty) 집 row. */
export function withHome(places: ExcludedPlace[]): ExcludedPlace[] {
  const home = places.find((p) => p.kind === 'home') ?? { id: HOME_ID, kind: 'home' as const, address: '' };
  return [home, ...places.filter((p) => p.kind !== 'home')];
}

/** 집 is required before anything can be shared. */
export function hasHome(places: ExcludedPlace[]): boolean {
  return places.some((p) => p.kind === 'home' && p.address.trim().length > 0);
}

/** Spaces, punctuation and case don't make two addresses different. */
export function normalizeAddress(address: string): string {
  return address.toLowerCase().replace(/[\s,.\-·()]/g, '');
}

/** Whether a shared place falls on one of the excluded addresses. */
export function isExcluded(place: { center: [number, number]; address?: string }, places: ExcludedPlace[]): boolean {
  const address = place.address ? normalizeAddress(place.address) : '';
  return places.some((p) => {
    if (!p.address.trim()) return false;
    if (p.center && haversineMeters(p.center, place.center) <= EXCLUDE_RADIUS_M) return true;
    // Without a found location, only the same written address can match:
    // equal, or one ending in the other ('성수이로 88' vs '서울 성동구
    // 성수이로 88') — and only down to a building number, so a bare road
    // ('청계천로') never swallows every address along it.
    const own = normalizeAddress(p.address);
    if (!address || !own) return false;
    if (address === own) return true;
    const [short, long] = address.length < own.length ? [address, own] : [own, address];
    return /\d/.test(short) && long.endsWith(short);
  });
}

/** `items` without the ones on an excluded address, and how many went. */
export function withoutExcluded<T>(
  items: readonly T[],
  placeOf: (item: T) => { center: [number, number]; address?: string },
  places: ExcludedPlace[],
): { kept: T[]; removed: number } {
  const kept = items.filter((item) => !isExcluded(placeOf(item), places));
  return { kept, removed: items.length - kept.length };
}
