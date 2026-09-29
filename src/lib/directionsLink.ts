import type { PlaceRef, TravelMode } from '../types/course';

// Kakao Map URL scheme: https://map.kakao.com/link/by/{mode}/name,lat,lng/name,lat,lng
// The web link also hands off to the Kakao Map app on phones where it's installed.
const KAKAO_MODE: Record<TravelMode, string> = { walk: 'walk', transit: 'traffic', drive: 'car' };

// Commas and slashes separate fields in this scheme, so they can't appear in names.
const safeName = (name: string) => encodeURIComponent(name.replace(/[,/]/g, ' ').trim() || '장소');

const point = (place: PlaceRef) => `${safeName(place.name)},${place.center[1]},${place.center[0]}`;

export function kakaoDirectionsUrl(from: PlaceRef, to: PlaceRef, mode: TravelMode): string {
  return `https://map.kakao.com/link/by/${KAKAO_MODE[mode]}/${point(from)}/${point(to)}`;
}

export function kakaoPlaceUrl(place: PlaceRef): string {
  const kakaoId = place.id.startsWith('kakao:') ? place.id.slice('kakao:'.length) : null;
  return kakaoId ? `https://place.map.kakao.com/${encodeURIComponent(kakaoId)}` : `https://map.kakao.com/link/map/${point(place)}`;
}
