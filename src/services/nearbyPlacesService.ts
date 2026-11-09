import type { AdminArea } from '../domain/adminAreas';
import type { Bbox, MapViewport } from '../domain/districtMap';
import { nearbyPlaceBounds, nearbyPlacesEnabled, shopCandidates } from '../domain/nearbyPlaces';
import type { KindShop } from '../domain/placeMatch';
import { mapDataRoot } from '../lib/mapData';
import type { PlaceRef } from '../types/course';
import { StaticAdminAreaService } from './adminAreaService';
import { StaticPlaceKindService } from './placeKindService';
import { LandmarkService } from './landmarkService';
import { landmarkFame, landmarksEnabled, type Landmark } from '../domain/landmarkPlaces';
import { EMPTY_PROFILE, selectScene, type PlaceProfile, type SceneCandidate } from '../domain/poiScene';

export interface SceneOptions {
  profile?: PlaceProfile;
  /** Ids on screen now; they stay while still on screen (see selectScene). */
  keep?: ReadonlySet<string>;
  /** The user's pins on the map: no place sticker or name goes over them. */
  avoid?: readonly (readonly [number, number])[];
}

export class NearbyPlacesService {
  constructor(
    private readonly admin: { sggAreasInBounds(bounds: Bbox): Promise<AdminArea[]> } = new StaticAdminAreaService(),
    private readonly shops: { loadShops(code: string): Promise<KindShop[] | null> } = new StaticPlaceKindService(async () => null, `${mapDataRoot()}places/`),
    private readonly landmarks: { fetch(viewport: MapViewport): Promise<Landmark[]> } = new LandmarkService(),
  ) {}

  /** One screen's places: one per kind. `onLandmarks` gets the landmark-only scene before slow shop files. */
  async fetch(viewport: MapViewport, options: SceneOptions = {}, onLandmarks?: (places: PlaceRef[]) => void): Promise<PlaceRef[]> {
    const { bounds: b, widthPx } = viewport;
    if (![b.west, b.south, b.east, b.north, widthPx].every(Number.isFinite) ||
      b.west >= b.east || b.south >= b.north || widthPx <= 0 || !landmarksEnabled(viewport)) return [];
    const profile = options.profile ?? EMPTY_PROFILE;
    const landmarks = this.landmarks.fetch(viewport).catch(() => [] as Landmark[]).then((places) => {
      const candidates: SceneCandidate[] = places.map((place) => ({ place, fame: landmarkFame(place) }));
      onLandmarks?.(selectScene(candidates, viewport, profile, options.keep, options.avoid));
      return candidates;
    });
    const shops = nearbyPlacesEnabled(viewport) ? this.fetchShops(viewport) : Promise.resolve([]);
    const [named, nearby] = await Promise.all([landmarks, shops]);
    return selectScene([...named, ...nearby], viewport, profile, options.keep, options.avoid);
  }

  private async fetchShops(viewport: MapViewport): Promise<SceneCandidate[]> {
    try {
      const areas = await this.admin.sggAreasInBounds(nearbyPlaceBounds(viewport));
      const lists = await Promise.all(areas.map((area) => this.shops.loadShops(area.code).catch(() => null)));
      return shopCandidates(lists.flatMap((list) => list ?? []), viewport);
    } catch {
      return [];
    }
  }
}
