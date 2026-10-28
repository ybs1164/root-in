import { Geolocation } from '@capacitor/geolocation';
import type { PlaceRef } from '../types/course';
import { isNativeApp } from './native';

export type LocationError = 'denied' | 'disabled' | 'timeout' | 'unavailable' | 'unsupported';
export const LOCATION_MESSAGES: Record<LocationError, string> = {
  denied: '위치 권한이 꺼져 있어요. 설정에서 위치 접근을 허용해 주세요.',
  disabled: '기기의 위치 기능이 꺼져 있어요. 위치 설정에서 켜 주세요.',
  timeout: '위치를 찾는 데 시간이 걸려요. 잠시 후 다시 시도해 주세요.',
  unavailable: '지금 위치를 찾지 못했어요. 잠시 후 다시 시도해 주세요.',
  unsupported: '이 환경에서는 위치 기능을 사용할 수 없어요.',
};

function locationError(error: unknown): LocationError {
  const code = (error as { code?: number | string } | null)?.code;
  if (code === 1 || code === 'OS-PLUG-GLOC-0003') return 'denied';
  if (['OS-PLUG-GLOC-0007', 'OS-PLUG-GLOC-0009', 'OS-PLUG-GLOC-0017'].includes(String(code))) return 'disabled';
  if (code === 3 || code === 'OS-PLUG-GLOC-0010') return 'timeout';
  return 'unavailable';
}

const centerOf = (coords: { longitude: number; latitude: number }): [number, number] => [
  Math.round(coords.longitude * 1e6) / 1e6,
  Math.round(coords.latitude * 1e6) / 1e6,
];

export type LocationResult = { center: [number, number]; at: number; error?: never } | { error: LocationError; center?: never; at?: never };

/** Requests permission and, on Android, offers to enable location services. */
export async function requestLocation(): Promise<LocationResult> {
  try {
    if (isNativeApp()) {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      return { center: centerOf(position.coords), at: position.timestamp || Date.now() };
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) return { error: 'unsupported' };
    return await new Promise<LocationResult>((resolve) => navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => resolve({ center: centerOf(coords), at: timestamp || Date.now() }),
      (error) => resolve({ error: locationError(error) }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    ));
  } catch (error) {
    return { error: locationError(error) };
  }
}

/** One-shot current position as a pin place; failures resolve null. */
export async function getCurrentPlace(name: string): Promise<PlaceRef | null> {
  const result = await requestLocation();
  if (!result.center) return null;
  const [lon, lat] = result.center;
  return { id: `pin:${lon},${lat}`, name, center: result.center };
}

/** Stops safely even when the native watch ID has not arrived yet. */
export function watchPosition(
  onFix: (center: [number, number], at: number) => void,
  onError: (error: LocationError) => void = () => undefined,
): () => void {
  let stopped = false;
  if (isNativeApp()) {
    const watch = Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
      (position, error) => {
        if (stopped) return;
        if (error) onError(locationError(error));
        else if (position) onFix(centerOf(position.coords), position.timestamp || Date.now());
      },
    ).catch((error) => {
      if (!stopped) onError(locationError(error));
      return null;
    });
    return () => {
      if (stopped) return;
      stopped = true;
      void watch.then((id) => id ? Geolocation.clearWatch({ id }).catch(() => undefined) : undefined);
    };
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError('unsupported');
    return () => undefined;
  }
  const api = navigator.geolocation;
  const id = api.watchPosition(
    ({ coords, timestamp }) => { if (!stopped) onFix(centerOf(coords), timestamp || Date.now()); },
    (error) => { if (!stopped) onError(locationError(error)); },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
  );
  return () => { stopped = true; api.clearWatch(id); };
}
