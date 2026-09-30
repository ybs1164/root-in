export type LngLat = [number, number];
/** Meters east/north in a local flat frame. */
export type Xy = [number, number];

const METERS_PER_DEG = 111_320;

/** Equirectangular around `originLat`; plenty accurate at course scale (a few km). */
export function projection(originLat: number) {
  const kx = METERS_PER_DEG * Math.cos((originLat * Math.PI) / 180);
  return {
    toXy: ([lng, lat]: LngLat): Xy => [lng * kx, lat * METERS_PER_DEG],
    toLngLat: ([x, y]: Xy): LngLat => [x / kx, y / METERS_PER_DEG],
  };
}
export type Projection = ReturnType<typeof projection>;
