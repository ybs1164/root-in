import { useEffect, useState } from 'react';
import type { LonLat } from '../domain/districtMap';
import type { TerrainShapes } from '../domain/miniMap';
import { terrainService } from '../services/terrainService';

/**
 * The real map for the day's stops: `shapes` once fetched (null when there is
 * no data), `ready` once it is known which. Off (not 상세), it is ready with nothing.
 */
export function useTerrain(centers: LonLat[], enabled: boolean): { shapes: TerrainShapes | null; ready: boolean } {
  const key = centers.map((c) => c.join(',')).join(' ');
  const [done, setDone] = useState<{ key: string; shapes: TerrainShapes | null } | null>(null);
  useEffect(() => {
    if (!enabled || centers.length === 0) return;
    let alive = true;
    terrainService.fetch(centers).then((shapes) => alive && setDone({ key, shapes }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
  if (!enabled || centers.length === 0) return { shapes: null, ready: true };
  return done?.key === key ? { shapes: done.shapes, ready: true } : { shapes: null, ready: false };
}
