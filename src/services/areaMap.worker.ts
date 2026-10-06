import type { LabelCover } from '../domain/areaLabels';
import type { Bbox, MapViewport } from '../domain/districtMap';
import { AreaRenderer } from './areaRenderer';

/**
 * One long-lived worker: the area files it fetched, the clipper module and
 * the last drawing stay loaded between pans. Only the newest request is
 * worked on; older ones still waiting on files are dropped. A request may
 * send two updates: a quick draft, then the finished shapes.
 */
const renderer = new AreaRenderer();
let latest = 0;

self.onmessage = async (event: MessageEvent<{ id: number; viewport: MapViewport; focusRange?: Bbox; cover?: LabelCover }>) => {
  const { id, viewport, focusRange, cover } = event.data;
  latest = id;
  try {
    const update = await renderer.render(viewport, { focusRange, cover }, () => id === latest,
      (draft) => self.postMessage({ id, update: draft }));
    if (update) self.postMessage({ id, update });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
