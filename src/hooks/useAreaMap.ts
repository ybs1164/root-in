import { useEffect, useRef, useState } from 'react';
import type { AreaShapes } from '../domain/adminAreas';
import type { LabelCover } from '../domain/areaLabels';
import type { LonLat, MapViewport } from '../domain/districtMap';
import { AreaRenderer, type AreaUpdate } from '../services/areaRenderer';

interface AreaRequest {
  viewport: MapViewport;
  focusAt?: LonLat;
  cover?: LabelCover;
}

interface AreaClient {
  request(request: AreaRequest): void;
  dispose(): void;
}

/**
 * Sends screens to the one area worker (fetching, caching and rounding all
 * happen there, so pans never stall the main thread). Every update the
 * worker sends is applied, even one for a screen since passed: the worker
 * compares the next screen against what it last sent, so skipping one here
 * would leave the two out of step. Falls back to the main thread where
 * there are no workers (tests) or the worker fails to start.
 */
function createAreaClient(apply: (update: AreaUpdate) => void): AreaClient {
  let latest = 0;
  let disposed = false;
  let last: AreaRequest | null = null;
  let local: AreaRenderer | null = null;
  const renderLocally = (id: number, { viewport, focusAt, cover }: AreaRequest) => {
    local ??= new AreaRenderer();
    void local.render(viewport, { focusAt, cover }, () => id === latest).then((update) => {
      if (update && !disposed) apply(update);
    });
  };
  let worker: Worker | null = null;
  if (typeof Worker !== 'undefined') {
    try {
      worker = new Worker(new URL('../services/areaMap.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ update?: AreaUpdate; error?: string }>) => {
        if (event.data.update && !disposed) apply(event.data.update);
        else if (event.data.error && import.meta.env.DEV) console.warn('Admin areas rendering failed', event.data.error);
      };
      worker.onerror = () => {
        worker?.terminate();
        worker = null;
        if (last && !disposed) renderLocally(++latest, last);
      };
    } catch {
      worker = null;
    }
  }
  return {
    request(request) {
      last = request;
      const id = ++latest;
      if (worker) worker.postMessage({ id, ...request });
      else renderLocally(id, request);
    },
    dispose() {
      disposed = true;
      worker?.terminate();
    },
  };
}

/**
 * The 시군구 (or 시도, zoomed out) at the screen center split into its
 * sub-areas, with neighbors as whole shapes and the areas' names. Redrawn
 * when the zoom or the focus changes or the screen leaves what was drawn;
 * the old shapes stay up meanwhile.
 */
export function useAreaMap(viewport: MapViewport | null, focusAt?: LonLat | null, cover?: LabelCover): AreaShapes | null {
  const [shapes, setShapes] = useState<AreaShapes | null>(null);
  const client = useRef<AreaClient | null>(null);
  useEffect(() => {
    const created = createAreaClient((update) => {
      if ('shapes' in update) setShapes(update.shapes);
      // Same polygons, labels moved: the maps keep their drawn polygons.
      else setShapes((current) => (current ? { ...current, labels: update.labels } : current));
    });
    client.current = created;
    return () => {
      created.dispose();
      client.current = null;
    };
  }, []);
  const bounds = viewport?.bounds;
  const key = bounds
    ? [bounds.west, bounds.south, bounds.east, bounds.north, viewport?.widthPx, focusAt?.join(), cover && Object.values(cover).join()].join(',')
    : '';
  useEffect(() => {
    if (!viewport) return;
    const timer = setTimeout(() => client.current?.request({ viewport, focusAt: focusAt ?? undefined, cover }), 100);
    return () => clearTimeout(timer);
    // The key covers the bounds, pixel width, focus and cover the result depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return shapes;
}
