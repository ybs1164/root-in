import type { LabelCover } from '../domain/areaLabels';
import type { AdminArea } from '../domain/adminAreas';
import { metersPerPixel, type Bbox, type MapViewport } from '../domain/districtMap';
import { NEARBY_MAX_MPP, selectNearbyPlaces } from '../domain/nearbyPlaces';
import type { KindShop } from '../domain/placeMatch';
import { mapDataRoot } from '../lib/mapData';
import type { PlaceRef } from '../types/course';
import { StaticAdminAreaService } from './adminAreaService';
import { StaticPlaceKindService } from './placeKindService';

export class NearbyPlacesService {
  constructor(
    private readonly admin: { sggAreasInBounds(bounds: Bbox): Promise<AdminArea[]> } = new StaticAdminAreaService(),
    private readonly shops: { loadShops(code: string): Promise<KindShop[] | null> } = new StaticPlaceKindService(async () => null, `${mapDataRoot()}places/`),
  ) {}

  async fetch(viewport: MapViewport, cover?: LabelCover): Promise<PlaceRef[]> {
    const { bounds: b, widthPx } = viewport;
    if (![b.west, b.south, b.east, b.north, widthPx].every(Number.isFinite) ||
      b.west >= b.east || b.south >= b.north || widthPx <= 0 || metersPerPixel(viewport) > NEARBY_MAX_MPP) return [];
    try {
      const areas = await this.admin.sggAreasInBounds(b);
      const lists = await Promise.all(areas.map((area) => this.shops.loadShops(area.code)));
      return selectNearbyPlaces(lists.flatMap((list) => list ?? []), viewport, cover);
    } catch {
      return [];
    }
  }
}
