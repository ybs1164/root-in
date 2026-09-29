import { haversineMeters } from '../../domain/geo';
import type { KakaoMapsNamespace, KakaoPlaceResult } from '../../lib/kakaoSdk';
import type { PlaceRef } from '../../types/course';
import {
  MAX_NEARBY_RESULTS,
  MAX_SEARCH_RESULTS,
  pointPlace,
  type PlaceSearchOptions,
  type PlaceSearchService,
} from './placeSearchService';

// Category groups a route-in is likely to be at: cafe, restaurant, attraction, culture.
const NEARBY_CATEGORY_CODES = ['CE7', 'FD6', 'AT4', 'CT1'];
const NEARBY_RADIUS_M = 120;

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
  private geocoder: InstanceType<KakaoMapsNamespace['services']['Geocoder']> | null = null;

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

  reverse(center: [number, number], { signal }: { signal?: AbortSignal } = {}): Promise<PlaceRef | null> {
    if (signal?.aborted) return Promise.resolve(null);
    return new Promise((resolve) => {
      signal?.addEventListener('abort', () => resolve(null), { once: true });
      try {
        this.geocoder ??= new this.maps.services.Geocoder();
        this.geocoder.coord2Address(center[0], center[1], (result, status) => {
          const first = status === this.maps.services.Status.OK && Array.isArray(result) ? result[0] : undefined;
          const address = first?.road_address?.address_name || first?.address?.address_name;
          if (!address) return resolve(null);
          resolve(pointPlace(center, first?.road_address?.building_name || address, address));
        });
      } catch {
        resolve(null);
      }
    });
  }

  async nearby(center: [number, number], { signal }: { signal?: AbortSignal } = {}): Promise<PlaceRef[]> {
    const one = (code: string) =>
      new Promise<PlaceRef[]>((resolve) => {
        if (signal?.aborted) return resolve([]);
        signal?.addEventListener('abort', () => resolve([]), { once: true });
        try {
          this.places.categorySearch(
            code,
            (data, status) =>
              resolve(
                status === this.maps.services.Status.OK && Array.isArray(data)
                  ? data.map(toPlaceRef).filter((p): p is PlaceRef => p !== null)
                  : [],
              ),
            {
              location: new this.maps.LatLng(center[1], center[0]),
              radius: NEARBY_RADIUS_M,
              sort: this.maps.services.SortBy?.DISTANCE,
              size: MAX_NEARBY_RESULTS,
            },
          );
        } catch {
          resolve([]);
        }
      });
    const all = (await Promise.all(NEARBY_CATEGORY_CODES.map(one))).flat();
    const unique = [...new Map(all.map((p) => [p.id, p])).values()];
    return unique
      .sort((a, b) => haversineMeters(center, a.center) - haversineMeters(center, b.center))
      .slice(0, MAX_NEARBY_RESULTS);
  }
}
