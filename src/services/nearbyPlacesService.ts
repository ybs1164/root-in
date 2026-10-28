import type { AdminArea } from '../domain/adminAreas';
import type { Bbox, MapViewport } from '../domain/districtMap';
import { nearbyPlaceBounds, nearbyPlacesEnabled, selectNearbyPlaces } from '../domain/nearbyPlaces';
import type { KindShop } from '../domain/placeMatch';
import { mapDataRoot } from '../lib/mapData';
import type { PlaceRef } from '../types/course';
import { StaticAdminAreaService } from './adminAreaService';
import { StaticPlaceKindService } from './placeKindService';
import { LandmarkService } from './landmarkService';
import { landmarksEnabled } from '../domain/landmarkPlaces';

export class NearbyPlacesService {
  constructor(
    private readonly admin: { sggAreasInBounds(bounds: Bbox): Promise<AdminArea[]> } = new StaticAdminAreaService(),
    private readonly shops: { loadShops(code: string): Promise<KindShop[] | null> } = new StaticPlaceKindService(async () => null, `${mapDataRoot()}places/`),
    private readonly landmarks: { fetch(viewport: MapViewport): Promise<PlaceRef[]> } = new LandmarkService(),
  ) {}

  async fetch(viewport: MapViewport, onLandmarks?: (places: PlaceRef[]) => void): Promise<PlaceRef[]> {
    const { bounds: b, widthPx } = viewport;
    if (![b.west, b.south, b.east, b.north, widthPx].every(Number.isFinite) ||
      b.west >= b.east || b.south >= b.north || widthPx <= 0 || !landmarksEnabled(viewport)) return [];
    const landmarks = this.landmarks.fetch(viewport).catch(() => []).then((places) => {
      onLandmarks?.(places);
      return places;
    });
    const shops = nearbyPlacesEnabled(viewport) ? this.fetchShops(viewport) : Promise.resolve([]);
    const [named, nearby] = await Promise.all([landmarks, shops]);
    return [...nearby, ...named];
  }

  private async fetchShops(viewport: MapViewport): Promise<PlaceRef[]> {
    try {
      const areas = await this.admin.sggAreasInBounds(nearbyPlaceBounds(viewport));
      const lists = await Promise.all(areas.map((area) => this.shops.loadShops(area.code).catch(() => null)));
      return selectNearbyPlaces(lists.flatMap((list) => list ?? []), viewport);
    } catch {
      return [];
    }
  }
}
