import type { TravelMode } from '../types/course';

export type LonLat = [number, number];

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

// No routing API is used (plan 1.5), so times are rough estimates from the
// straight-line distance: a detour factor for real streets, an average speed,
// and a fixed overhead for transit (walking to/waiting at a stop).
const MODE_PROFILE: Record<TravelMode, { detour: number; metersPerMinute: number; overheadMinutes: number }> = {
  walk: { detour: 1.3, metersPerMinute: 75, overheadMinutes: 0 },
  transit: { detour: 1.4, metersPerMinute: 350, overheadMinutes: 10 },
  drive: { detour: 1.4, metersPerMinute: 400, overheadMinutes: 3 },
};

export interface LegEstimate {
  meters: number;
  minutes: number;
}

export function estimateLeg(from: LonLat, to: LonLat, mode: TravelMode): LegEstimate {
  const profile = MODE_PROFILE[mode];
  const meters = haversineMeters(from, to) * profile.detour;
  // Transit for a short hop is slower than walking; nobody would take it.
  const minutes =
    mode === 'transit' && meters < 1200
      ? meters / MODE_PROFILE.walk.metersPerMinute
      : meters / profile.metersPerMinute + profile.overheadMinutes;
  return { meters: Math.round(meters), minutes: Math.max(1, Math.round(minutes)) };
}

export function estimateCourse(points: LonLat[], mode: TravelMode): { legs: LegEstimate[]; total: LegEstimate } {
  const legs = points.slice(1).map((point, i) => estimateLeg(points[i], point, mode));
  const total = legs.reduce((sum, leg) => ({ meters: sum.meters + leg.meters, minutes: sum.minutes + leg.minutes }), {
    meters: 0,
    minutes: 0,
  });
  return { legs, total };
}

export const formatMeters = (meters: number) =>
  meters < 1000 ? `${Math.round(meters / 10) * 10}m` : `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)}km`;

export const formatMinutes = (minutes: number) => {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
};
