import { useEffect, useState } from 'react';
import type { BaseMap } from '../domain/baseMap';
import { type Bbox, type MapViewport } from '../domain/districtMap';
import { StaticKoreaMapService, type KoreaMapService } from '../services/koreaMapService';

const defaultService = new StaticKoreaMapService();

/** Country, city and street scales share the same locally bundled base map. */
export function useBaseMap(viewport: MapViewport | null, service: KoreaMapService = defaultService): BaseMap | null {
  const [loaded, setLoaded] = useState<{ bounds: Bbox; base: BaseMap } | null>(null);
  const bounds = viewport?.bounds;
  const key = bounds ? [bounds.west, bounds.south, bounds.east, bounds.north, viewport?.widthPx].join(',') : '';
  useEffect(() => {
    if (!viewport) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const base = await service.fetchBaseMap(viewport, controller.signal);
      if (controller.signal.aborted) return;
      setLoaded(base ? { bounds: viewport.bounds, base } : null);
    }, 100);
    return () => { clearTimeout(timer); controller.abort(); };
    // The key includes geographic bounds and pixel width (detail level).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, service]);
  // Keep the current tiles during nearby pans/zooms until their replacement
  // arrives. A search jump must not show unrelated land from the old view.
  return bounds && loaded && loaded.bounds.west < bounds.east && bounds.west < loaded.bounds.east &&
    loaded.bounds.south < bounds.north && bounds.south < loaded.bounds.north ? loaded.base : null;
}
