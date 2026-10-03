import { haversineMeters } from './geo';

// 개인 정보 → 제외 주소: places the user never wants to show up in anything
// they share (home first, and required). Matching is done twice so either
// half of a snapshot is enough: by position (a ping has only coordinates)
// and by address text (a place saved without a picked suggestion has no
// position of its own).

export interface ExcludedPlace {
  id: string;
  /** '집', '회사' … shown in front of the address. */
  label: string;
  address: string;
  /** Known when the address was picked from search; text-only otherwise. */
  center?: [number, number];
}

export const HOME_ID = 'home';

export const PRIVACY_LIMITS = {
  label: 12,
  address: 100,
  /** Home included. */
  places: 10,
  /** Anything this close to an excluded place counts as that place. */
  radiusMeters: 150,
};

export const HOME: ExcludedPlace = { id: HOME_ID, label: '집', address: '' };

export function homeIsSet(places: ExcludedPlace[]): boolean {
  return places.some((p) => p.id === HOME_ID && p.address.trim() !== '');
}

/** Spacing and the long forms of city names differ between providers ("서울특별시" vs "서울"). */
export function normalizeAddress(address: string): string {
  return address
    .replace(/(특별자치시|특별자치도|특별시|광역시)/g, '')
    .replace(/[\s,.·()]/g, '')
    .toLowerCase();
}

/**
 * Same address, or one is the other with more of the region in front
 * ("성동구 아차산로9길 8" ⊂ "서울 성동구 아차산로9길 8"). The shorter one has
 * to carry a number and may not stop partway through one, so "아차산로9길 8"
 * doesn't swallow "아차산로9길 88" and a bare district never matches.
 */
export function addressesMatch(a: string, b: string): boolean {
  const x = normalizeAddress(a);
  const y = normalizeAddress(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length < 6 || !/\d/.test(short)) return false;
  const at = long.indexOf(short);
  if (at < 0) return false;
  const next = long[at + short.length];
  return next === undefined || !/\d/.test(next);
}

export function isExcluded(place: { address?: string; center?: [number, number] }, excluded: ExcludedPlace[]): boolean {
  return excluded.some(
    (e) =>
      (e.center && place.center && haversineMeters(e.center, place.center) <= PRIVACY_LIMITS.radiusMeters) ||
      (place.address !== undefined && e.address.trim() !== '' && addressesMatch(place.address, e.address)),
  );
}

/** What's left to share, and how many were taken out. */
export function withoutExcluded<T>(
  items: T[],
  placeOf: (item: T) => { address?: string; center?: [number, number] },
  excluded: ExcludedPlace[],
): { kept: T[]; removed: number } {
  const kept = items.filter((item) => !isExcluded(placeOf(item), excluded));
  return { kept, removed: items.length - kept.length };
}

/** The notice a share shows when places were taken out. */
export function excludedNotice(removed: number): string | undefined {
  return removed > 0 ? `제외 주소에 있는 ${removed}곳은 공유에서 빠졌어요.` : undefined;
}

export const HOME_REQUIRED_MESSAGE = '공유하려면 프로필 → 개인 정보에서 집 주소를 먼저 입력해 주세요.';
