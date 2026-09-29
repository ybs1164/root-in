import { haversineMeters } from '../../domain/geo';
import type { PlaceRef } from '../../types/course';
import {
  MAX_NEARBY_RESULTS,
  MAX_SEARCH_RESULTS,
  pointPlace,
  type PlaceSearchOptions,
  type PlaceSearchService,
} from './placeSearchService';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse';
// Photon's reverse lookup also returns roads and admin areas; a "where am I"
// candidate should be a place someone would visit, close by.
const NEARBY_MAX_M = 150;
const NOT_A_VISIT = new Set(['highway', 'place', 'boundary', 'railway', 'landuse']);
const SEARCH_TIMEOUT_MS = 8000;

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    osm_key?: string;
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

  private async reverseFeatures(center: [number, number], limit: number, signal?: AbortSignal): Promise<PhotonFeature[]> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    try {
      const params = new URLSearchParams({ lon: String(center[0]), lat: String(center[1]), limit: String(limit) });
      const response = await fetch(`${PHOTON_REVERSE_URL}?${params}`, { signal: controller.signal });
      if (!response.ok) return [];
      const data = (await response.json()) as { features?: PhotonFeature[] };
      return data.features ?? [];
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async reverse(center: [number, number], { signal }: { signal?: AbortSignal } = {}): Promise<PlaceRef | null> {
    const [first] = await this.reverseFeatures(center, 1, signal);
    const place = first ? photonToPlaceRef(first) : null;
    const name = place?.name ?? place?.address;
    // The id stays the dropped point: the pin is where the user put it.
    return name ? pointPlace(center, name, place?.address) : null;
  }

  async nearby(center: [number, number], { signal }: { signal?: AbortSignal } = {}): Promise<PlaceRef[]> {
    const features = await this.reverseFeatures(center, 10, signal);
    return features
      .filter((f) => !NOT_A_VISIT.has(f.properties?.osm_key ?? ''))
      .map(photonToPlaceRef)
      .filter((p): p is PlaceRef => p !== null && haversineMeters(center, p.center) <= NEARBY_MAX_M)
      .sort((a, b) => haversineMeters(center, a.center) - haversineMeters(center, b.center))
      .slice(0, MAX_NEARBY_RESULTS);
  }
}
