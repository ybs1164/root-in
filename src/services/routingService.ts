// Public OSRM demo server — free, no API key, same "keyless public API" style
// already used for POI (Overpass) and terrain (AWS Open Data) in this app.
// Not meant for heavy/production traffic, but fine for a demo routing lookup.
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';
const ROUTE_FETCH_TIMEOUT_MS = 10000;

export interface RouteGeometry {
  /** 'road': an actual routed path from OSRM. 'straight': no road route found
   *  (e.g. origin/destination separated by sea, or the lookup failed/timed
   *  out) — a straight line between the two points is used instead so the
   *  map always has *something* to show. */
  type: 'road' | 'straight';
  coordinates: [number, number][];
  distanceMeters?: number;
  durationSeconds?: number;
}

const buildStraightRoute = (
  origin: [number, number],
  destination: [number, number],
): RouteGeometry => ({ type: 'straight', coordinates: [origin, destination] });

/**
 * Looks up a driving route between two [lon, lat] points and always
 * resolves — falling back to a straight line on any failure (no road
 * connection, network error, timeout) rather than rejecting, so callers
 * never need a try/catch just to keep the map showing a route.
 */
export async function fetchRoute(
  origin: [number, number],
  destination: [number, number],
  externalSignal?: AbortSignal,
): Promise<RouteGeometry> {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);
  const timeoutId = setTimeout(() => controller.abort(), ROUTE_FETCH_TIMEOUT_MS);

  try {
    const url = `${OSRM_BASE_URL}/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route) {
      return buildStraightRoute(origin, destination);
    }

    return {
      type: 'road',
      coordinates: route.geometry.coordinates as [number, number][],
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  } catch {
    return buildStraightRoute(origin, destination);
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
