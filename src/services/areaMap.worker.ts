import type { LabelCover } from '../domain/areaLabels';
import type { LonLat, MapViewport } from '../domain/districtMap';
import { AreaRenderer } from './areaRenderer';

/**
 * One long-lived worker: the area files it fetched, the clipper module and
 * the last drawing stay loaded between pans. Only the newest request is
 * worked on; older ones still waiting on files are dropped.
 */
const renderer = new AreaRenderer();
let latest = 0;

self.onmessage = async (event: MessageEvent<{ id: number; viewport: MapViewport; focusAt?: LonLat; cover?: LabelCover }>) => {
  const { id, viewport, focusAt, cover } = event.data;
  latest = id;
  try {
    const update = await renderer.render(viewport, { focusAt, cover }, () => id === latest);
    if (update) self.postMessage({ id, update });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
