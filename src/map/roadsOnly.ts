/**
 * "Roads only" basemap for the MapLibre fallback: the course line and pins
 * are the content, so the basemap keeps just enough to read the route —
 * roads, rail, water and road names — and drops shops, buildings, place
 * names and land use that compete with our own markers.
 *
 * Matched against the Carto Voyager layer ids (CartoDB/basemap-styles,
 * mapboxgl/voyager.json). Unknown ids are hidden, so a style update can only
 * make the map emptier, never re-introduce POI clutter.
 */
const KEEP = [/^background$/, /^water(_shadow)?$/, /^waterway$/, /^(tunnel|road|bridge)_/, /^(tunnel_)?rail(_dash)?$/, /^roadname_/];

export function isRoadsOnlyLayer(id: string): boolean {
  return KEEP.some((re) => re.test(id));
}
