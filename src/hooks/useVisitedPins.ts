import { useEffect } from 'react';
import { addPlacesAsPins } from '../domain/pin';
import { visitedPlaces } from '../domain/visitedPlaces';
import { loadVisitedPings, saveVisitedPings } from '../services/visitedPinRepository';
import type { Pin } from '../types/pin';
import type { usePins } from './usePins';

/** Places I've been (my pings) become 미분류 pins, each ping looked at once. */
export function useVisitedPins(storedPings: Parameters<typeof visitedPlaces>[0], pins: Pin[], transform: ReturnType<typeof usePins>['transform']): void {
  useEffect(() => {
    const done = loadVisitedPings();
    let settled: string[] = [];
    const ready = transform(({ pins: now, categories: kinds }, make) => {
      const visit = visitedPlaces(storedPings, now, done);
      settled = visit.settled;
      if (!visit.places.length) return null;
      return { pins: addPlacesAsPins(now, visit.places, make.pin).pins, categories: kinds };
    });
    if (!ready || !settled.length) return;
    settled.forEach((id) => done.add(id));
    saveVisitedPings(done);
  }, [storedPings, pins, transform]);
}
