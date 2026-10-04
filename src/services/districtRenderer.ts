import type { DistrictMap, MapViewport } from '../domain/districtMap';
import { renderDistrictMap } from '../domain/districtRendering';

export function renderDistrict(map: DistrictMap, viewport: MapViewport, signal?: AbortSignal): Promise<DistrictMap | null> {
  if (signal?.aborted) return Promise.resolve(null);
  if (map.sourceRoadWidthM === undefined) return Promise.resolve(map);
  if (typeof Worker === 'undefined') return Promise.resolve(renderDistrictMap(map, viewport));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../domain/districtRendering.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => { signal?.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => { finish(); resolve(null); };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ map?: DistrictMap; error?: string }>) => {
      finish();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.map ?? null);
    };
    worker.onerror = (event) => { finish(); reject(new Error(event.message)); };
    worker.postMessage({ map, viewport });
  });
}
