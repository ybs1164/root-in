import { useEffect, useMemo, useState } from 'react';
import {
  bboxContains,
  buildDistrictMap,
  districtOptionsFor,
  mergeDualCarriageways,
  metersPerPixel,
  pruneDeadEnds,
  viewportRegion,
  type Bbox,
  type CourseRegion,
  type DistrictMap,
  type MapViewport,
  type RoadSegment,
} from '../domain/districtMap';
import { OverpassRoadNetwork, type RoadNetworkService } from '../services/roadNetworkService';

const defaultService = new OverpassRoadNetwork();

interface Fetched {
  region: CourseRegion;
  /** Divided roads merged, dead ends stripped; widths are applied per zoom at build time. */
  roads: RoadSegment[];
}

// Panning or zooming back to somewhere already seen shouldn't hit Overpass again.
const cache: Fetched[] = [];
const CACHE_LIMIT = 8;
const DEBOUNCE_MS = 400;

/** Fetched roads are reusable if they cover the screen at the needed detail. */
const findCovering = (bounds: Bbox, wanted: CourseRegion): Fetched | undefined =>
  cache.find((f) => bboxContains(f.region.bbox, bounds) && (f.region.includeMinor || !wanted.includeMinor));

const overlaps = (a: Bbox, b: Bbox) => a.west < b.east && b.west < a.east && a.south < b.north && b.south < a.north;

const boundsKey = (b: Bbox) => [b.west, b.south, b.east, b.north].map((n) => n.toFixed(5)).join(',');

// Quarter-zoom steps: widths stay within ~9% of the 4–8px band without
// rebuilding the blocks for every tiny pinch.
const zoomBucket = (mpp: number) => Math.round(Math.log2(mpp) * 4) / 4;

/**
 * The illustrated block map for whatever is on screen. Null when zoomed out
 * to city scale or when no roads came back — the map then shows its normal
 * basemap. While a new area loads, the previous map stays up.
 */
export function useDistrictMap(
  viewport: MapViewport | null,
  service: RoadNetworkService = defaultService,
): DistrictMap | null {
  const bounds = viewport?.bounds ?? null;
  const key = bounds ? boundsKey(bounds) : '';
  const wanted = useMemo(
    () => (bounds ? viewportRegion(bounds) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const bucket = viewport ? zoomBucket(metersPerPixel(viewport)) : 0;
  const [fetched, setFetched] = useState<Fetched | null>(null);

  useEffect(() => {
    if (!bounds || !wanted) return;
    const hit = findCovering(bounds, wanted);
    if (hit) {
      setFetched(hit);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const roads = await service.fetchRoads({ bbox: wanted.bbox, includeMinor: wanted.includeMinor }, controller.signal);
      if (controller.signal.aborted || roads.length === 0) return;
      const entry = { region: wanted, roads: pruneDeadEnds(mergeDualCarriageways(roads), wanted.region) };
      cache.unshift(entry);
      if (cache.length > CACHE_LIMIT) cache.pop();
      setFetched(entry);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, wanted, service]);

  const built = useMemo(() => {
    if (!fetched) return null;
    const map = buildDistrictMap(fetched.region.region, fetched.roads, districtOptionsFor(2 ** bucket));
    return map.blocks.length > 0 ? map : null;
  }, [fetched, bucket]);

  // After a jump elsewhere (search, fit), a stale map would cover the basemap
  // with an empty road color; show the basemap until the new area arrives.
  return bounds && wanted && fetched && overlaps(fetched.region.bbox, bounds) ? built : null;
}
