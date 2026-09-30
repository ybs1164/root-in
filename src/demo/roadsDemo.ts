/**
 * Dev-only example (open /roads.html): pulls road geometry out of the Carto
 * vector tiles as GeoJSON and draws it with our own tokens. Nothing of the
 * provider's rendering is shown — the map is exactly the JSON you can download:
 * the streets (no footpaths) the sample course runs along, found by routing
 * over the extracted roads. The routing itself is never drawn.
 *
 * `?at=lng,lat,zoom` picks the spot (default: 용산).
 */
import maplibregl, { type ExpressionSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles.css';
import { createMarkerElement } from '../map/courseMap';
import { toRoadCollection, type RoadCollection } from '../map/roadFeatures';
import { roadsAlongCourse } from '../map/roadRoute';

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const CARTO = 'carto';
// An invisible layer on the Carto source: MapLibre only loads tiles for
// sources that have a visible layer, and we still need the tiles to query.
const PROBE = 'roads-probe';

const [lng = 126.978, lat = 37.5275, zoom = 16] = (new URLSearchParams(location.search).get('at') ?? '')
  .split(',')
  .map(Number)
  .filter((n) => Number.isFinite(n) && n !== 0);

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const map = new maplibregl.Map({
  container: 'map',
  style: STYLE_URL,
  center: [lng, lat],
  zoom,
  attributionControl: { compact: true },
});

// Road width in px by zoom, the same for every rank so the course line is
// the only thing that stands out; exponential so it grows like the ground does.
const width = (z12: number, z16: number, z19: number): ExpressionSpecification => [
  'interpolate', ['exponential', 1.6], ['zoom'], 12, z12, 16, z16, 19, z19,
];
const road = ['==', ['get', 'kind'], 'road'] as ExpressionSpecification;

map.on('style.load', () => {
  for (const layer of map.getStyle().layers) {
    if (layer.id !== 'background') map.setLayoutProperty(layer.id, 'visibility', 'none');
  }
  map.setPaintProperty('background', 'background-color', token('--map-land'));
  map.addLayer({ id: PROBE, type: 'line', source: CARTO, 'source-layer': 'transportation', paint: { 'line-opacity': 0 } });

  map.addSource('roads', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  const lineLayout = { 'line-cap': 'round', 'line-join': 'round' } as const;
  map.addLayer({
    id: 'roads-fill',
    type: 'line',
    source: 'roads',
    filter: road,
    layout: lineLayout,
    paint: {
      'line-color': token('--map-road'),
      'line-width': width(5.4, 30, 78),
    },
  });

  drawSampleCourse();
});

// A sample course; only the roads it runs along are drawn.
const stops: [number, number][] = [
  [lng - 0.0022, lat + 0.0016],
  [lng + 0.0004, lat - 0.0012],
  [lng + 0.0024, lat + 0.0018],
];

function drawSampleCourse() {
  map.addSource('course', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: stops } } });
  map.addLayer({
    id: 'course',
    type: 'line',
    source: 'course',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': token('--route'), 'line-width': 12, 'line-opacity': 0.9, 'line-dasharray': [1.5, 1.5] },
  });
  stops.forEach((p, i) => new maplibregl.Marker({ element: createMarkerElement(String(i + 1), 'stop') }).setLngLat(p).addTo(map));
}

let roads: RoadCollection = { type: 'FeatureCollection', features: [] };
let pending = 0;

// Re-extract whenever Carto tiles finish loading (pan/zoom). Our own
// `roads` source updates fire sourcedata for 'roads', not 'carto', so this
// can't feed back into itself.
map.on('sourcedata', (e) => {
  if (e.sourceId !== CARTO || !map.isSourceLoaded(CARTO)) return;
  clearTimeout(pending);
  pending = window.setTimeout(extract, 120);
});

function extract() {
  const all = toRoadCollection(map.querySourceFeatures(CARTO, { sourceLayer: 'transportation' }));
  // Footpaths are left out: the course is read off the street grid.
  const streets: RoadCollection = { ...all, features: all.features.filter((f) => f.properties.rank !== 'path') };
  const result = roadsAlongCourse(streets, stops);
  roads = result.roads;
  (map.getSource('roads') as maplibregl.GeoJSONSource | undefined)?.setData(roads);
  const missed = result.missedLegs > 0 ? ` · 못 이은 구간 ${result.missedLegs}개` : '';
  document.getElementById('count')!.textContent = `코스 도로 ${roads.features.length}구간${missed}`;
}

document.getElementById('download')!.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(roads)], { type: 'application/geo+json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'roads.geojson' });
  a.click();
  URL.revokeObjectURL(url);
});

// Handy for checking the extracted JSON from devtools.
(window as unknown as { __roads: () => RoadCollection }).__roads = () => roads;
