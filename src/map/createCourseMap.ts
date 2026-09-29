import { loadKakaoMaps } from '../lib/kakaoSdk';
import { KakaoPlaceSearch } from '../services/placeSearch/kakaoPlaceSearch';
import { PhotonPlaceSearch } from '../services/placeSearch/photonPlaceSearch';
import type { PlaceSearchService } from '../services/placeSearch/placeSearchService';
import type { CourseMap, CourseMapOptions } from './courseMap';

export interface MapStack {
  map: CourseMap;
  search: PlaceSearchService;
}

/**
 * Picks Kakao when its SDK loads (key present, domain registered), otherwise
 * the keyless MapLibre + Photon pair. Map and search always come from the
 * same provider so search results can legally be shown on that map.
 */
export async function createMapStack(container: HTMLElement, options: CourseMapOptions): Promise<MapStack> {
  const kakao = await loadKakaoMaps();
  if (kakao) {
    try {
      const { KakaoCourseMap } = await import('./kakaoCourseMap');
      return { map: new KakaoCourseMap(kakao, container, options), search: new KakaoPlaceSearch(kakao) };
    } catch {
      // fall through to the keyless stack
    }
  }
  const { MapLibreCourseMap } = await import('./maplibreCourseMap');
  return { map: new MapLibreCourseMap(container, options), search: new PhotonPlaceSearch() };
}
