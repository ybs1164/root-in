import { useEffect, useRef, useState } from 'react';
import type { MapViewport } from '../domain/districtMap';
import { landmarksEnabled, selectLandmarks, type Landmark } from '../domain/landmarkPlaces';
import { nearbyPlacesEnabled } from '../domain/nearbyPlaces';
import { mapDataRoot } from '../lib/mapData';
import { NearbyPlacesService } from '../services/nearbyPlacesService';
import type { PlaceRef } from '../types/course';

/** Independent of terrain rendering: a slow place file never delays the map. */
export function useNearbyPlaces(viewport: MapViewport | null): PlaceRef[] {
  const [places, setPlaces] = useState<PlaceRef[]>([]);
  const client = useRef<{ request(viewport: MapViewport): void } | null>(null);
  useEffect(() => {
    let worker: Worker | null = null;
    let local: NearbyPlacesService | null = null;
    let latest = 0;
    let disposed = false;
    let last: MapViewport | null = null;
    const apply = (id: number, result: PlaceRef[], partial = false) => {
      if (!disposed && id === latest) setPlaces((previous) => partial
        ? [...previous.filter((place) => last && nearbyPlacesEnabled(last) && !place.id.startsWith('landmark:')), ...result] : result);
    };
    const fallback = (id: number, view: MapViewport) => {
      local ??= new NearbyPlacesService();
      void local.fetch(view, (result) => apply(id, result, true)).then((result) => apply(id, result));
    };
    if (typeof Worker !== 'undefined') {
      try {
        worker = new Worker(new URL('../services/nearbyPlaces.worker.ts', import.meta.url), { type: 'module' });
        worker.postMessage({ base: new URL(mapDataRoot(), document.baseURI).href,
          landmarkBase: new URL(`${import.meta.env.BASE_URL}map-landmarks/`, document.baseURI).href });
        worker.onmessage = (event: MessageEvent<{ id: number; places: PlaceRef[]; partial?: boolean }>) => apply(event.data.id, event.data.places, event.data.partial);
        worker.onerror = () => {
          worker?.terminate();
          worker = null;
          if (last && !disposed) fallback(++latest, last);
        };
      } catch { worker?.terminate(); worker = null; }
    }
    client.current = { request(view) {
      last = view;
      const id = ++latest;
      // Keep accurately positioned markers while the next screen loads.
      // Zooming out hides them immediately; stale replies cannot restore them.
      if (!landmarksEnabled(view)) { setPlaces([]); return; }
      if (!nearbyPlacesEnabled(view)) setPlaces((previous) => selectLandmarks(
        previous.filter((place): place is Landmark => place.id.startsWith('landmark:') && 'importance' in place), view));
      if (worker) worker.postMessage({ id, viewport: view });
      else fallback(id, view);
    } };
    return () => { disposed = true; worker?.terminate(); client.current = null; };
  }, []);
  const key = JSON.stringify(viewport);
  useEffect(() => {
    if (!viewport) return;
    client.current?.request(viewport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return places;
}
