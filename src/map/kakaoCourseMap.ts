import type { DistrictMap } from '../domain/districtMap';
import type { KakaoMapInstance, KakaoMapsNamespace } from '../lib/kakaoSdk';
import type { PlaceRef } from '../types/course';
import {
  attachLongPress,
  createMarkerElement,
  createPinElement,
  type CourseMap,
  type CourseMapOptions,
  type MapPadding,
  type PinMarker,
} from './courseMap';

type Overlay = { setMap(map: KakaoMapInstance | null): void };

const FOCUS_LEVEL = 4;

export class KakaoCourseMap implements CourseMap {
  readonly provider = 'kakao' as const;
  private readonly map: KakaoMapInstance;
  private stops: PlaceRef[] = [];
  private stopOverlays: Overlay[] = [];
  private line: Overlay | null = null;
  private preview: Overlay | null = null;
  private pinOverlays: Overlay[] = [];
  private guide: Overlay | null = null;
  private districtOverlays: Overlay[] = [];
  private readonly container: HTMLElement;
  private attribution: HTMLElement | null = null;
  private readonly detachLongPress: () => void;

  constructor(
    private readonly maps: KakaoMapsNamespace,
    container: HTMLElement,
    private readonly options: CourseMapOptions,
  ) {
    this.container = container;
    this.map = new maps.Map(container, { center: this.latLng(options.center), level: 6 });
    this.detachLongPress = attachLongPress(container, (x, y) => {
      const at = this.map.getProjection().coordsFromContainerPoint(new maps.Point(x, y));
      options.onLongPress?.([at.getLng(), at.getLat()]);
    });
    const emitViewport = () => {
      const b = this.map.getBounds();
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      options.onViewportChange?.({
        bounds: { west: sw.getLng(), south: sw.getLat(), east: ne.getLng(), north: ne.getLat() },
        widthPx: container.clientWidth,
      });
    };
    maps.event.addListener(this.map, 'idle', emitViewport);
    // Not every SDK version fires idle for the first render.
    setTimeout(emitViewport, 0);
  }

  private routeColor(token: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
  }

  setDistrictMap(district: DistrictMap | null): void {
    this.districtOverlays.forEach((o) => o.setMap(null));
    this.districtOverlays = [];
    this.attribution?.remove();
    this.attribution = null;
    if (!district) return;
    const ring = (points: [number, number][]) => points.map((p) => this.latLng(p));
    // Kakao tiles can't be restyled, so a Korea-sized polygon hides them.
    const cover = new this.maps.Polygon({
      path: ring([[120, 30], [135, 30], [135, 45], [120, 45]]),
      strokeWeight: 0,
      strokeOpacity: 0,
      fillColor: this.routeColor('--map-road', '#f4ede2'),
      fillOpacity: 1,
      zIndex: 0,
      map: this.map,
    });
    const blockColor = this.routeColor('--map-block', '#a9c1c1');
    const blocks = district.blocks.map(
      (block) =>
        new this.maps.Polygon({
          path: [ring(block.outer), ...block.holes.map(ring)],
          strokeWeight: 0,
          strokeOpacity: 0,
          fillColor: blockColor,
          fillOpacity: 1,
          zIndex: 1,
          map: this.map,
        }),
    );
    this.districtOverlays = [cover, ...blocks];
    // The block shapes come from OSM (ODbL), which Kakao's own credit doesn't cover.
    this.attribution = document.createElement('div');
    this.attribution.className = 'map-attribution';
    this.attribution.textContent = '© OpenStreetMap contributors';
    this.container.appendChild(this.attribution);
  }

  setPins(pins: PinMarker[]): void {
    this.pinOverlays.forEach((o) => o.setMap(null));
    this.pinOverlays = pins.map(
      (pin) =>
        new this.maps.CustomOverlay({
          position: this.latLng(pin.center),
          content: createPinElement(pin, this.options.onPinClick),
          yAnchor: 0.5,
          zIndex: pin.selected ? 4 : 1,
          map: this.map,
        }),
    );
  }

  setGuideLine(points: [number, number][] | null): void {
    this.guide?.setMap(null);
    this.guide =
      points && points.length >= 2
        ? new this.maps.Polyline({
            path: points.map((p) => this.latLng(p)),
            strokeWeight: 3,
            strokeColor: this.routeColor('--muted', '#8b7d74'),
            strokeOpacity: 0.8,
            strokeStyle: 'shortdot',
            map: this.map,
          })
        : null;
  }

  fitPoints(points: [number, number][], padding: MapPadding): void {
    if (points.length === 0) return;
    if (points.length === 1) return this.focus(points[0]);
    const bounds = new this.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(this.latLng(p)));
    this.map.setBounds(bounds, padding.top, padding.right, padding.bottom, padding.left);
  }

  private latLng([lon, lat]: [number, number]) {
    return new this.maps.LatLng(lat, lon);
  }

  setCourse(stops: PlaceRef[]): void {
    this.stops = stops;
    this.stopOverlays.forEach((o) => o.setMap(null));
    this.line?.setMap(null);
    this.line = null;

    this.stopOverlays = stops.map(
      (stop, index) =>
        new this.maps.CustomOverlay({
          position: this.latLng(stop.center),
          content: createMarkerElement(String(index + 1), 'stop', () => this.options.onStopClick?.(index)),
          yAnchor: 0.5,
          zIndex: 2,
          map: this.map,
        }),
    );
    if (stops.length >= 2) {
      this.line = new this.maps.Polyline({
        path: stops.map((s) => this.latLng(s.center)),
        strokeWeight: 4,
        strokeColor: this.routeColor('--route', '#e0664f'),
        strokeOpacity: 0.85,
        strokeStyle: 'shortdash',
        map: this.map,
      });
    }
  }

  setPreview(place: PlaceRef | null): void {
    this.preview?.setMap(null);
    this.preview = place
      ? new this.maps.CustomOverlay({
          position: this.latLng(place.center),
          content: createMarkerElement('＋', 'preview'),
          yAnchor: 0.5,
          zIndex: 3,
          map: this.map,
        })
      : null;
  }

  fitCourse(padding: MapPadding): void {
    this.fitPoints(
      this.stops.map((s) => s.center),
      padding,
    );
  }

  focus(center: [number, number]): void {
    if (this.map.getLevel() > FOCUS_LEVEL) this.map.setLevel(FOCUS_LEVEL);
    this.map.panTo(this.latLng(center));
  }

  centerOn(center: [number, number]): void {
    this.map.panTo(this.latLng(center));
  }

  getCenter(): [number, number] {
    const c = this.map.getCenter();
    return [c.getLng(), c.getLat()];
  }

  resize(): void {
    this.map.relayout();
  }

  destroy(): void {
    this.detachLongPress();
    this.setDistrictMap(null);
    this.pinOverlays.forEach((o) => o.setMap(null));
    this.guide?.setMap(null);
    this.stopOverlays.forEach((o) => o.setMap(null));
    this.line?.setMap(null);
    this.preview?.setMap(null);
  }
}
