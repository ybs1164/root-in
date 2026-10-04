import { renderAreaMap, type AreaMap } from './adminAreas';
import type { MapViewport } from './districtMap';

self.onmessage = (event: MessageEvent<{ map: AreaMap; viewport: MapViewport }>) => {
  try {
    self.postMessage({ shapes: renderAreaMap(event.data.map, event.data.viewport) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
