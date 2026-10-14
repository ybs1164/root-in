import type { PlaceRef } from '../types/course';

/**
 * One-shot current position as a pin place. Resolves null (never rejects)
 * when permission is denied, the API is missing, or it times out.
 */
export function getCurrentPlace(name: string): Promise<PlaceRef | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const lon = Math.round(coords.longitude * 1e6) / 1e6;
        const lat = Math.round(coords.latitude * 1e6) / 1e6;
        resolve({ id: `pin:${lon},${lat}`, name, center: [lon, lat] });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/**
 * Follows the phone's position: `onFix` on every update (rounded like
 * getCurrentPlace). Returns the stop. Does nothing without the API or once
 * permission is denied.
 */
export function watchPosition(onFix: (center: [number, number], at: number) => void): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return () => undefined;
  const id = navigator.geolocation.watchPosition(
    ({ coords, timestamp }) => {
      const lon = Math.round(coords.longitude * 1e6) / 1e6;
      const lat = Math.round(coords.latitude * 1e6) / 1e6;
      onFix([lon, lat], timestamp || Date.now());
    },
    () => undefined,
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
