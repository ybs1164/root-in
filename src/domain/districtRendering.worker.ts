import { renderDistrictMap } from './districtRendering';
import type { DistrictMap, MapViewport } from './districtMap';

self.onmessage = (event: MessageEvent<{ map: DistrictMap; viewport: MapViewport }>) => {
  try {
    self.postMessage({ map: renderDistrictMap(event.data.map, event.data.viewport) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
