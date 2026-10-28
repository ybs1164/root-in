import type { LabelCover } from '../domain/areaLabels';
import type { MapViewport } from '../domain/districtMap';
import { StaticAdminAreaService } from './adminAreaService';
import { AreaRenderer } from './areaRenderer';
import { StaticKoreaMapService } from './koreaMapService';

/**
 * One long-lived worker: the area files it fetched, the clipper module and
 * the last drawing stay loaded between pans. Only the newest request is
 * worked on; older ones still waiting on files are dropped. A request may
 * send two updates: a quick draft, then the finished shapes.
 */
let renderer: AreaRenderer | null = null;
let latest = 0;

type Message = { base: string; mapBase: string } | { id: number; viewport: MapViewport; cover?: LabelCover };

self.onmessage = async (event: MessageEvent<Message>) => {
  // First the page says where the area files and base map tiles are (absolute URLs).
  if ('base' in event.data) {
    renderer = new AreaRenderer(new StaticAdminAreaService(event.data.base), new StaticKoreaMapService(event.data.mapBase));
    return;
  }
  renderer ??= new AreaRenderer();
  const { id, viewport, cover } = event.data;
  latest = id;
  try {
    const update = await renderer.render(viewport, { cover }, () => id === latest,
      (draft) => self.postMessage({ id, update: draft }));
    if (update) self.postMessage({ id, update });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
