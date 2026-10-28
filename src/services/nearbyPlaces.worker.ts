import type { MapViewport } from '../domain/districtMap';
import { StaticAdminAreaService } from './adminAreaService';
import { StaticPlaceKindService } from './placeKindService';
import { NearbyPlacesService } from './nearbyPlacesService';
import { LandmarkService } from './landmarkService';

let service: NearbyPlacesService;
let latest = 0;
type Message = { base: string; landmarkBase: string } | { id: number; viewport: MapViewport };
self.onmessage = async (event: MessageEvent<Message>) => {
  if ('base' in event.data) {
    service = new NearbyPlacesService(new StaticAdminAreaService(`${event.data.base}admin/`),
      new StaticPlaceKindService(async () => null, `${event.data.base}places/`), new LandmarkService(event.data.landmarkBase));
    return;
  }
  const { id, viewport } = event.data;
  latest = id;
  service ??= new NearbyPlacesService();
  const places = await service.fetch(viewport, (places) => {
    if (latest === id) self.postMessage({ id, places, partial: true });
  });
  if (latest === id) self.postMessage({ id, places });
};
