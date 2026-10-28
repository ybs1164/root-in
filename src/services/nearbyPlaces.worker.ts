import type { LabelCover } from '../domain/areaLabels';
import type { MapViewport } from '../domain/districtMap';
import { StaticAdminAreaService } from './adminAreaService';
import { StaticPlaceKindService } from './placeKindService';
import { NearbyPlacesService } from './nearbyPlacesService';

let service: NearbyPlacesService;
let latest = 0;
type Message = { base: string } | { id: number; viewport: MapViewport; cover?: LabelCover };
self.onmessage = async (event: MessageEvent<Message>) => {
  if ('base' in event.data) {
    service = new NearbyPlacesService(new StaticAdminAreaService(`${event.data.base}admin/`),
      new StaticPlaceKindService(async () => null, `${event.data.base}places/`));
    return;
  }
  const { id, viewport, cover } = event.data;
  latest = id;
  service ??= new NearbyPlacesService();
  const places = await service.fetch(viewport, cover);
  if (latest === id) self.postMessage({ id, places });
};
