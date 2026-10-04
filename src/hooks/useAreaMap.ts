import { useEffect, useState } from 'react';
import { renderAreaMap, type AreaMap, type AreaShapes } from '../domain/adminAreas';
import type { LonLat, MapViewport } from '../domain/districtMap';
import { StaticAdminAreaService, type AdminAreaService } from '../services/adminAreaService';

const defaultService = new StaticAdminAreaService();

/** Rounding thousands of vertices per area would stall pans on the main thread. */
function renderInWorker(map: AreaMap, viewport: MapViewport, signal: AbortSignal): Promise<AreaShapes | null> {
  if (typeof Worker === 'undefined') return Promise.resolve(renderAreaMap(map, viewport));
  return new Promise((resolve) => {
    const worker = new Worker(new URL('../domain/adminAreas.worker.ts', import.meta.url), { type: 'module' });
    const finish = (shapes: AreaShapes | null) => {
      signal.removeEventListener('abort', abort);
      worker.terminate();
      resolve(shapes);
    };
    const abort = () => finish(null);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ shapes?: AreaShapes }>) => finish(event.data.shapes ?? null);
    worker.onerror = () => finish(null);
    worker.postMessage({ map, viewport });
  });
}

/**
 * The 시군구 (or 시도, zoomed out) at the screen center split into its
 * sub-areas, with neighbors as whole shapes. Recomputed per pan/zoom because
 * gaps and corner radii are in screen pixels; the old shapes stay up meanwhile.
 */
export function useAreaMap(
  viewport: MapViewport | null,
  focusAt?: LonLat | null,
  service: AdminAreaService = defaultService,
): AreaShapes | null {
  const [shapes, setShapes] = useState<AreaShapes | null>(null);
  const bounds = viewport?.bounds;
  const key = bounds ? [bounds.west, bounds.south, bounds.east, bounds.north, viewport?.widthPx, focusAt?.join()].join(',') : '';
  useEffect(() => {
    if (!viewport) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const map = await service.fetchAreaMap(viewport, focusAt ?? undefined, controller.signal);
      if (!map || controller.signal.aborted) return;
      const next = await renderInWorker(map, viewport, controller.signal);
      if (next && !controller.signal.aborted) setShapes(next);
    }, 100);
    return () => { clearTimeout(timer); controller.abort(); };
    // The key covers the bounds, pixel width and focus the shapes depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, service]);
  return shapes;
}
