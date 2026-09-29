// Minimal typings for the parts of the Kakao Maps JS SDK this app uses.
// The SDK ships no official types; keep this list as small as the usage.
export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

export interface KakaoPlaceResult {
  id: string;
  place_name: string;
  category_name: string;
  category_group_name: string;
  road_address_name: string;
  address_name: string;
  x: string; // longitude
  y: string; // latitude
}

export interface KakaoAddressResult {
  road_address: { address_name: string; building_name?: string } | null;
  address: { address_name: string } | null;
}

export interface KakaoMapsNamespace {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => { extend(latlng: KakaoLatLng): void };
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: HTMLElement;
    yAnchor?: number;
    xAnchor?: number;
    zIndex?: number;
    map?: KakaoMapInstance;
  }) => { setMap(map: KakaoMapInstance | null): void };
  Polyline: new (options: {
    path: KakaoLatLng[];
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    strokeStyle: string;
    map?: KakaoMapInstance;
  }) => { setMap(map: KakaoMapInstance | null): void };
  event: {
    addListener(target: unknown, type: string, handler: (...args: unknown[]) => void): void;
  };
  Point: new (x: number, y: number) => unknown;
  services: {
    Places: new () => {
      keywordSearch(
        query: string,
        callback: (data: KakaoPlaceResult[], status: string) => void,
        options?: { location?: KakaoLatLng; size?: number },
      ): void;
      categorySearch(
        code: string,
        callback: (data: KakaoPlaceResult[], status: string) => void,
        options?: { location?: KakaoLatLng; radius?: number; sort?: string; size?: number },
      ): void;
    };
    Geocoder: new () => {
      coord2Address(lng: number, lat: number, callback: (result: KakaoAddressResult[], status: string) => void): void;
    };
    Status: { OK: string; ZERO_RESULT: string; ERROR: string };
    SortBy: { DISTANCE: string; ACCURACY: string };
  };
}

export interface KakaoMapInstance {
  getCenter(): KakaoLatLng;
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number, options?: { animate?: boolean }): void;
  getLevel(): number;
  panTo(latlng: KakaoLatLng): void;
  setBounds(bounds: unknown, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void;
  relayout(): void;
  getProjection(): { coordsFromContainerPoint(point: unknown): KakaoLatLng };
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsNamespace };
  }
}

export const kakaoJsKey = (): string => (import.meta.env.VITE_KAKAO_JS_KEY as string | undefined)?.trim() ?? '';

const SDK_TIMEOUT_MS = 8000;
let loading: Promise<KakaoMapsNamespace | null> | null = null;

/**
 * Loads the Kakao Maps SDK once. Resolves null (never rejects) when there is
 * no key, the script is blocked, or the domain isn't registered for the key —
 * callers then fall back to the keyless MapLibre/Photon implementations.
 */
export function loadKakaoMaps(): Promise<KakaoMapsNamespace | null> {
  if (loading) return loading;
  const key = kakaoJsKey();
  if (!key || typeof document === 'undefined') return (loading = Promise.resolve(null));

  loading = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), SDK_TIMEOUT_MS);
    const done = (value: KakaoMapsNamespace | null) => {
      clearTimeout(timer);
      resolve(value);
    };
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;
    script.async = true;
    script.onerror = () => {
      // Almost always a 401 "domain mismatched": this origin isn't registered
      // for the key (Kakao console → 플랫폼 → Web). The fallback map takes over.
      console.warn(
        `[root-in] 카카오 SDK를 불러오지 못해 대체 지도를 사용합니다. 카카오 개발자 콘솔의 Web 플랫폼에 ${window.location.origin} 이 등록돼 있는지 확인하세요.`,
      );
      done(null);
    };
    script.onload = () => {
      const maps = window.kakao?.maps;
      if (!maps) return done(null);
      maps.load(() => done(maps));
    };
    document.head.appendChild(script);
  });
  return loading;
}
