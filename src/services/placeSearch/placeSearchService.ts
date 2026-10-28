import type { PlaceRef } from '../../types/course';

export const MAX_SEARCH_RESULTS = 10;

export interface PlaceSearchOptions {
  /** [lon, lat] to rank nearby places first (usually the map center). */
  near?: [number, number];
  signal?: AbortSignal;
}

/**
 * Keyword place search. Implementations never reject: a failed or aborted
 * lookup resolves to [] so the UI only has to handle "no results".
 */
export interface PlaceSearchService {
  readonly provider: 'kakao' | 'photon';
  search(query: string, options?: PlaceSearchOptions): Promise<PlaceRef[]>;
  /**
   * What is at this exact point, named by its address (for a dropped pin).
   * Null when unknown — the caller names it "지정한 위치".
   */
  reverse(center: [number, number], options?: { signal?: AbortSignal }): Promise<PlaceRef | null>;
  /** Named places around a point, nearest first (route-in candidates; `limit` defaults to MAX_NEARBY_RESULTS). */
  nearby(center: [number, number], options?: { signal?: AbortSignal; limit?: number }): Promise<PlaceRef[]>;
}

export const MAX_NEARBY_RESULTS = 3;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** An unnamed spot: the id encodes the point, so pinning it twice is one pin. */
/** What a picked spot is called until reverse geocoding names it. */
export const UNNAMED_SPOT = '지정한 위치';

export function pointPlace(center: [number, number], name = UNNAMED_SPOT, address?: string): PlaceRef {
  const [lon, lat] = [round6(center[0]), round6(center[1])];
  const place: PlaceRef = { id: `pin:${lon},${lat}`, name, center: [lon, lat] };
  if (address) place.address = address;
  return place;
}
