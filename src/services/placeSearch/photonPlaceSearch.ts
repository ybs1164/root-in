import type { PlaceRef } from '../../types/course';
import { MAX_SEARCH_RESULTS, type PlaceSearchOptions, type PlaceSearchService } from './placeSearchService';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const SEARCH_TIMEOUT_MS = 8000;

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    osm_value?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
  };
}

export const photonToPlaceRef = (feature: PhotonFeature): PlaceRef | null => {
  const p = feature.properties ?? {};
  const coords = feature.geometry?.coordinates;
  if (!p.name || !p.osm_type || p.osm_id === undefined || !Array.isArray(coords)) return null;
  const place: PlaceRef = { id: `osm:${p.osm_type}${p.osm_id}`, name: p.name, center: [coords[0], coords[1]] };
  if (p.osm_value) place.category = p.osm_value;
  const address = [p.city, p.district, p.street, p.housenumber].filter(Boolean).join(' ');
  if (address) place.address = address;
  return place;
};

/** Keyless fallback (OSM data) used when the Kakao SDK isn't available. */
export class PhotonPlaceSearch implements PlaceSearchService {
  readonly provider = 'photon' as const;

  async search(query: string, { near, signal }: PlaceSearchOptions = {}): Promise<PlaceRef[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    try {
      const params = new URLSearchParams({ q: trimmed, limit: String(MAX_SEARCH_RESULTS) });
      if (near) {
        params.set('lon', String(near[0]));
        params.set('lat', String(near[1]));
      }
      const response = await fetch(`${PHOTON_URL}?${params}`, { signal: controller.signal });
      if (!response.ok) return [];
      const data = (await response.json()) as { features?: PhotonFeature[] };
      return (data.features ?? [])
        .map(photonToPlaceRef)
        .filter((p): p is PlaceRef => p !== null)
        .slice(0, MAX_SEARCH_RESULTS);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}
