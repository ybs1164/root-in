import { useEffect, useRef, useState } from 'react';
import type { MapViewport } from '../domain/districtMap';
import { landmarkEligible, landmarkScale, landmarksEnabled, type Landmark } from '../domain/landmarkPlaces';
import { nearbyPlacesEnabled } from '../domain/nearbyPlaces';
import { declutter, EMPTY_PROFILE, inScene, type PlaceProfile } from '../domain/poiScene';
import { mapDataRoot } from '../lib/mapData';
import { NearbyPlacesService } from '../services/nearbyPlacesService';
import type { PlaceRef } from '../types/course';

const isLandmark = (place: PlaceRef): place is Landmark => place.id.startsWith('landmark:') && 'importance' in place;

type Point = [number, number];
const NO_PINS: Point[] = [];

/**
 * One screen's map places, one per kind, none touching another or one of
 * `pins` (the user's pins on the map; domain/poiScene.ts). Independent of
 * terrain rendering: a slow place file never delays the map.
 */
export function useNearbyPlaces(viewport: MapViewport | null, profile: PlaceProfile = EMPTY_PROFILE, pins: Point[] = NO_PINS): PlaceRef[] {
  const [places, setPlaces] = useState<PlaceRef[]>([]);
  const client = useRef<{ request(viewport: MapViewport): void; setProfile(profile: PlaceProfile): void; setPins(pins: Point[]): void } | null>(null);
  useEffect(() => {
    let worker: Worker | null = null;
    let local: NearbyPlacesService | null = null;
    let latest = 0;
    let disposed = false;
    let last: MapViewport | null = null;
    let shown: PlaceRef[] = [];
    let shownScale = Infinity;
    let currentProfile = EMPTY_PROFILE;
    let avoid: Point[] = [];
    const show = (next: PlaceRef[], view: MapViewport | null) => {
      shown = next;
      if (view) shownScale = landmarkScale(view);
      setPlaces(next);
    };
    const apply = (id: number, result: PlaceRef[], partial = false) => {
      if (disposed || id !== latest) return;
      if (!partial || !last) { show(result, last); return; }
      // Landmarks arrive first: keep the previous shops of other kinds on
      // screen until the full scene replaces them, never two of one kind.
      const kinds = new Set(result.map((place) => place.kind));
      const view = last;
      // Landmarks (best first) win any overlap with the shops kept meanwhile.
      show(declutter([...result, ...shown.filter((place) => !place.id.startsWith('landmark:') && nearbyPlacesEnabled(view) &&
        !kinds.has(place.kind) && inScene(place.center, view))], view, avoid), view);
    };
    const fallback = (id: number, view: MapViewport, keep: string[]) => {
      local ??= new NearbyPlacesService();
      void local.fetch(view, { profile: currentProfile, keep: new Set(keep), avoid }, (result) => apply(id, result, true))
        .then((result) => apply(id, result));
    };
    const send = (view: MapViewport) => {
      last = view;
      const id = ++latest;
      // Zoomed out, the scene starts over (a better place may now be in view);
      // moved or zoomed in, what is on screen stays while it stays on screen.
      const keep = landmarkScale(view) <= shownScale * 1.0001 ? shown.map((place) => place.id) : [];
      if (worker) worker.postMessage({ id, viewport: view, keep, avoid });
      else fallback(id, view, keep);
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
          if (last && !disposed) send(last);
        };
      } catch { worker?.terminate(); worker = null; }
    }
    client.current = {
      request(view) {
        // Keep accurately positioned markers while the next screen loads.
        // Zooming out hides them immediately; stale replies cannot restore them.
        if (!landmarksEnabled(view)) { ++latest; last = view; show([], view); return; }
        if (!nearbyPlacesEnabled(view)) {
          // A subset of a one-per-kind scene is still one per kind, but zooming
          // out brings places closer: drop the lower ones that now overlap.
          shown = declutter(shown.filter((place) => isLandmark(place) && landmarkEligible(place, view) && inScene(place.center, view)), view, avoid);
          setPlaces(shown);
        }
        send(view);
      },
      setProfile(profile) {
        currentProfile = profile;
        worker?.postMessage({ profile });
        // Re-ranks only what is off screen now; the rest changes on the next zoom out.
        if (last && landmarksEnabled(last)) send(last);
      },
      setPins(pins) {
        avoid = pins;
        if (!last || !landmarksEnabled(last)) return;
        // A new pin takes its spot at once; places it freed come with the reply.
        show(declutter(shown, last, avoid), last);
        send(last);
      },
    };
    return () => { disposed = true; worker?.terminate(); client.current = null; };
  }, []);
  // Pass a memoised profile: a new object re-ranks what is off screen.
  useEffect(() => { client.current?.setProfile(profile); }, [profile]);
  const pinsKey = JSON.stringify(pins);
  useEffect(() => {
    client.current?.setPins(pins);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey]);
  const key = JSON.stringify(viewport);
  useEffect(() => {
    if (!viewport) return;
    client.current?.request(viewport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return places;
}
