import type { KakaoMapInstance, KakaoMapsNamespace } from '../lib/kakaoSdk';
import type { PlaceRef } from '../types/course';
import { createMarkerElement, type CourseMap, type CourseMapOptions, type MapPadding } from './courseMap';

type Overlay = { setMap(map: KakaoMapInstance | null): void };

const FOCUS_LEVEL = 4;

export class KakaoCourseMap implements CourseMap {
  readonly provider = 'kakao' as const;
  private readonly map: KakaoMapInstance;
  private stops: PlaceRef[] = [];
  private stopOverlays: Overlay[] = [];
  private line: Overlay | null = null;
  private preview: Overlay | null = null;

  constructor(
    private readonly maps: KakaoMapsNamespace,
    container: HTMLElement,
    private readonly options: CourseMapOptions,
  ) {
    this.map = new maps.Map(container, { center: this.latLng(options.center), level: 6 });
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
        strokeColor: getComputedStyle(document.documentElement).getPropertyValue('--route').trim() || '#e0664f',
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
    if (this.stops.length === 0) return;
    if (this.stops.length === 1) return this.focus(this.stops[0].center);
    const bounds = new this.maps.LatLngBounds();
    this.stops.forEach((s) => bounds.extend(this.latLng(s.center)));
    this.map.setBounds(bounds, padding.top, padding.right, padding.bottom, padding.left);
  }

  focus(center: [number, number]): void {
    if (this.map.getLevel() > FOCUS_LEVEL) this.map.setLevel(FOCUS_LEVEL);
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
    this.stopOverlays.forEach((o) => o.setMap(null));
    this.line?.setMap(null);
    this.preview?.setMap(null);
  }
}
