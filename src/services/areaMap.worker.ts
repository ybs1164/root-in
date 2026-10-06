import type { LabelCover } from '../domain/areaLabels';
import type { LonLat, MapViewport } from '../domain/districtMap';
import { StaticAdminAreaService } from './adminAreaService';
import { AreaRenderer } from './areaRenderer';

/**
 * One long-lived worker: the area files it fetched, the clipper module and
 * the last drawing stay loaded between pans. Only the newest request is
 * worked on; older ones still waiting on files are dropped.
 */
let renderer: AreaRenderer | null = null;
let latest = 0;

type Message = { base: string } | { id: number; viewport: MapViewport; focusAt?: LonLat; cover?: LabelCover };

self.onmessage = async (event: MessageEvent<Message>) => {
  // First the page says where the area files are (an absolute URL).
  if ('base' in event.data) {
    renderer = new AreaRenderer(new StaticAdminAreaService(event.data.base));
    return;
  }
  renderer ??= new AreaRenderer();
  const { id, viewport, focusAt, cover } = event.data;
  latest = id;
  try {
    const update = await renderer.render(viewport, { focusAt, cover }, () => id === latest);
    if (update) self.postMessage({ id, update });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
