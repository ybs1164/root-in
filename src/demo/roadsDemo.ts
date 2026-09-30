/**
 * Dev-only example (open /roads.html): pulls road geometry out of the Carto
 * vector tiles as GeoJSON and draws it with our own tokens. Nothing of the
 * provider's rendering is shown — the map is exactly the JSON you can download.
 *
 * `?at=lng,lat,zoom` picks the spot (default: 용산).
 */
import maplibregl, { type ExpressionSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles.css';
import { createMarkerElement } from '../map/courseMap';
import { toRoadCollection, type RoadCollection } from '../map/roadFeatures';

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
const rank = (r: string): ExpressionSpecification => ['==', ['get', 'rank'], r];
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
    id: 'roads-path',
    type: 'line',
    source: 'roads',
    filter: ['all', road, rank('path')],
    layout: lineLayout,
    paint: { 'line-color': token('--map-path'), 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 1.2, 19, 2.5], 'line-dasharray': [2, 1.5] },
  });
  // All casings under all fills, so crossings merge instead of stacking.
  map.addLayer({
    id: 'roads-case',
    type: 'line',
    source: 'roads',
    filter: ['all', road, ['!=', ['get', 'rank'], 'path']],
    layout: lineLayout,
    paint: {
      'line-color': token('--map-road-case'),
      'line-width': width(1.8, 10, 26),
    },
  });
  map.addLayer({
    id: 'roads-fill',
    type: 'line',
    source: 'roads',
    filter: ['all', road, ['!=', ['get', 'rank'], 'path']],
    layout: lineLayout,
    paint: {
      'line-color': token('--map-road'),
      'line-width': width(1, 7.5, 22),
    },
  });
  map.addLayer({
    id: 'roads-name',
    type: 'symbol',
    source: 'roads',
    filter: ['==', ['get', 'kind'], 'name'],
    minzoom: 14,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'name'],
      // Carto's own road-name stack; NanumBarunGothic covers Hangul.
      'text-font': ['Montserrat Regular', 'Open Sans Regular', 'Noto Sans Regular', 'HanWangHeiLight Regular', 'NanumBarunGothic Regular'],
      'text-size': ['match', ['get', 'rank'], 'major', 13, 11.5],
      'text-letter-spacing': 0.02,
    },
    paint: { 'text-color': token('--map-label'), 'text-halo-color': token('--map-label-halo'), 'text-halo-width': 1.5 },
  });

  drawSampleCourse();
});

// A sample course on top, so the example reads like the app.
function drawSampleCourse() {
  const stops: [number, number][] = [
    [lng - 0.0022, lat + 0.0016],
    [lng + 0.0004, lat - 0.0012],
    [lng + 0.0024, lat + 0.0018],
  ];
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
  roads = toRoadCollection(
    map.querySourceFeatures(CARTO, { sourceLayer: 'transportation' }),
    map.querySourceFeatures(CARTO, { sourceLayer: 'transportation_name' }),
  );
  (map.getSource('roads') as maplibregl.GeoJSONSource | undefined)?.setData(roads);
  const lines = roads.features.filter((f) => f.properties.kind === 'road').length;
  const names = new Set(roads.features.flatMap((f) => (f.properties.name ? [f.properties.name] : []))).size;
  document.getElementById('count')!.textContent = `도로 조각 ${lines}개 · 도로명 ${names}개`;
}

document.getElementById('download')!.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(roads)], { type: 'application/geo+json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'roads.geojson' });
  a.click();
  URL.revokeObjectURL(url);
});

// Handy for checking the extracted JSON from devtools.
(window as unknown as { __roads: () => RoadCollection }).__roads = () => roads;
