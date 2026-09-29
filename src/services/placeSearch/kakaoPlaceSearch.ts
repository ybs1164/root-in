import type { KakaoMapsNamespace, KakaoPlaceResult } from '../../lib/kakaoSdk';
import type { PlaceRef } from '../../types/course';
import { MAX_SEARCH_RESULTS, type PlaceSearchOptions, type PlaceSearchService } from './placeSearchService';

// "음식점 > 한식 > 육류,고기" → "육류,고기": the last segment is the most specific.
const shortCategory = (result: KakaoPlaceResult) =>
  result.category_name.split('>').pop()?.trim() || result.category_group_name || undefined;

export const toPlaceRef = (result: KakaoPlaceResult): PlaceRef | null => {
  const lon = Number(result.x);
  const lat = Number(result.y);
  if (!result.id || !result.place_name || !Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const place: PlaceRef = { id: `kakao:${result.id}`, name: result.place_name, center: [lon, lat] };
  const category = shortCategory(result);
  const address = result.road_address_name || result.address_name;
  if (category) place.category = category;
  if (address) place.address = address;
  return place;
};

/** Uses the JS SDK's `services` library so no REST key is ever exposed. */
export class KakaoPlaceSearch implements PlaceSearchService {
  readonly provider = 'kakao' as const;
  private readonly places: InstanceType<KakaoMapsNamespace['services']['Places']>;

  constructor(private readonly maps: KakaoMapsNamespace) {
    this.places = new maps.services.Places();
  }

  search(query: string, { near, signal }: PlaceSearchOptions = {}): Promise<PlaceRef[]> {
    const trimmed = query.trim();
    if (!trimmed || signal?.aborted) return Promise.resolve([]);

    return new Promise((resolve) => {
      signal?.addEventListener('abort', () => resolve([]), { once: true });
      try {
        this.places.keywordSearch(
          trimmed,
          (data, status) => {
            if (status !== this.maps.services.Status.OK || !Array.isArray(data)) return resolve([]);
            resolve(
              data
                .map(toPlaceRef)
                .filter((p): p is PlaceRef => p !== null)
                .slice(0, MAX_SEARCH_RESULTS),
            );
          },
          {
            size: MAX_SEARCH_RESULTS,
            ...(near ? { location: new this.maps.LatLng(near[1], near[0]) } : {}),
          },
        );
      } catch {
        resolve([]);
      }
    });
  }
}
