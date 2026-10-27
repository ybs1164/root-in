import { useEffect, useRef, useState } from 'react';
import type { LabelCover } from '../domain/areaLabels';
import type { MapViewport } from '../domain/districtMap';
import { metersPerPixel } from '../domain/districtMap';
import { NEARBY_MAX_MPP } from '../domain/nearbyPlaces';
import { mapDataRoot } from '../lib/mapData';
import { NearbyPlacesService } from '../services/nearbyPlacesService';
import type { PlaceRef } from '../types/course';

/** Independent of terrain rendering: a slow place file never delays the map. */
export function useNearbyPlaces(viewport: MapViewport | null, cover?: LabelCover): PlaceRef[] {
  const [places, setPlaces] = useState<PlaceRef[]>([]);
  const client = useRef<{ request(viewport: MapViewport, cover?: LabelCover): void } | null>(null);
  useEffect(() => {
    let worker: Worker | null = null;
    let local: NearbyPlacesService | null = null;
    let latest = 0;
    let disposed = false;
    let last: { viewport: MapViewport; cover?: LabelCover } | null = null;
    const apply = (id: number, result: PlaceRef[]) => {
      if (!disposed && id === latest) setPlaces(result);
    };
    const fallback = (id: number, view: MapViewport, covered?: LabelCover) => {
      local ??= new NearbyPlacesService();
      void local.fetch(view, covered).then((result) => apply(id, result));
    };
    if (typeof Worker !== 'undefined') {
      try {
        worker = new Worker(new URL('../services/nearbyPlaces.worker.ts', import.meta.url), { type: 'module' });
        worker.postMessage({ base: new URL(mapDataRoot(), document.baseURI).href });
        worker.onmessage = (event: MessageEvent<{ id: number; places: PlaceRef[] }>) => apply(event.data.id, event.data.places);
        worker.onerror = () => {
          worker?.terminate();
          worker = null;
          if (last && !disposed) fallback(++latest, last.viewport, last.cover);
        };
      } catch { worker?.terminate(); worker = null; }
    }
    client.current = { request(view, covered) {
      last = { viewport: view, cover: covered };
      const id = ++latest;
      // Keep accurately positioned markers while the next screen loads.
      // Zooming out hides them immediately; stale replies cannot restore them.
      if (metersPerPixel(view) > NEARBY_MAX_MPP) { setPlaces([]); return; }
      if (worker) worker.postMessage({ id, viewport: view, cover: covered });
      else fallback(id, view, covered);
    } };
    return () => { disposed = true; worker?.terminate(); client.current = null; };
  }, []);
  const key = JSON.stringify([viewport, cover]);
  useEffect(() => {
    if (!viewport) return;
    const timer = setTimeout(() => client.current?.request(viewport, cover), 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return places;
}
