import type { MapViewport } from '../domain/districtMap';
import { EMPTY_PROFILE, type PlaceProfile } from '../domain/poiScene';
import { StaticAdminAreaService } from './adminAreaService';
import { StaticPlaceKindService } from './placeKindService';
import { NearbyPlacesService } from './nearbyPlacesService';
import { LandmarkService } from './landmarkService';

let service: NearbyPlacesService;
let profile: PlaceProfile = EMPTY_PROFILE;
let latest = 0;
type Message = { base: string; landmarkBase: string } | { profile: PlaceProfile } | { id: number; viewport: MapViewport; keep?: string[]; avoid?: [number, number][] };
self.onmessage = async (event: MessageEvent<Message>) => {
  if ('base' in event.data) {
    service = new NearbyPlacesService(new StaticAdminAreaService(`${event.data.base}admin/`),
      new StaticPlaceKindService(async () => null, `${event.data.base}places/`), new LandmarkService(event.data.landmarkBase));
    return;
  }
  if ('profile' in event.data) {
    profile = event.data.profile;
    return;
  }
  const { id, viewport, keep, avoid } = event.data;
  latest = id;
  service ??= new NearbyPlacesService();
  const places = await service.fetch(viewport, { profile, keep: new Set(keep), avoid }, (places) => {
    if (latest === id) self.postMessage({ id, places, partial: true });
  });
  if (latest === id) self.postMessage({ id, places });
};
