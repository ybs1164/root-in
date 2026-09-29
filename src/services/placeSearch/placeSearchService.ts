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
}
