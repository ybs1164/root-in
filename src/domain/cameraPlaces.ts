import type { PlaceRef } from '../types/course';
import { TODAY_PING_RADIUS_M, type StoredPing } from './dayPings';
import { haversineMeters } from './geo';
import { isExcluded, type ExcludedPlace } from './privacy';
import { samePlace, visitPlaceId } from './visitedPlaces';

/** How many places the camera offers to send the photo as (current spot included). */
export const CAMERA_PLACE_LIMIT = 10;

/** What the spot itself is called when reverse geocoding finds no name. */
export const HERE_NAME = '현재 위치';

/** 위치 선택's list, top to bottom: `visited`, then 직접 입력 (the dialog's own row), then `others`. */
export interface CameraPlaces {
  /** 방문한 적 있는 장소: places within 50m I've pinged before, nearest first. Empty: no such group. */
  visited: PlaceRef[];
  /** The spot I'm standing on (what 직접 입력 lands on); null when it can't be sent from. */
  here: PlaceRef | null;
  /** The rest: the spot itself, my other pins within 50m, then named places around. */
  others: PlaceRef[];
}

/** The first place of the list: what's picked until another is. */
export const firstCameraPlace = (places: CameraPlaces): PlaceRef | null => places.visited[0] ?? places.others[0] ?? null;

/**
 * Where a camera shot can say it was taken. On top, apart, the places within
 * 50m I've been to before, nearest first — a pin of mine that a ping was
 * recorded from (my own pin, or the 미분류 one a visit made), or a past ping
 * whose pin is gone. Below them (under the dialog's 직접 입력) the rest, as
 * before: the spot I'm standing on (named by reverse geocoding), then my
 * other pins within 50m, then named places around (cafés, restaurants…), each
 * nearest first. A place twice (same id, or the same name) is listed once —
 * so a visited one isn't repeated below — and none near a 제외 주소: those
 * never leave the phone. `CAMERA_PLACE_LIMIT` in all, a slot kept for the spot.
 */
export function cameraPlaces(
  here: [number, number],
  spot: PlaceRef | null,
  pins: readonly { id?: string; place: PlaceRef }[],
  around: readonly PlaceRef[],
  excluded: ExcludedPlace[],
  pings: readonly StoredPing[] = [],
): CameraPlaces {
  const close = (place: { center: [number, number] }) => haversineMeters(place.center, here) <= TODAY_PING_RADIUS_M;
  const near = (places: readonly PlaceRef[]) =>
    places
      .map((place) => ({ place, m: haversineMeters(place.center, here) }))
      .sort((a, b) => a.m - b.m)
      .map(({ place }) => place);
  // 제외 주소 pings never became pins, and aren't offered here either.
  const been = pings.filter((ping) => !ping.local);
  const pingOf = (pin: { id?: string; place: PlaceRef }) => (ping: StoredPing) =>
    (pin.id !== undefined && ping.pinId === pin.id) || pin.place.id === visitPlaceId(ping.id) || samePlace(pin.place, ping);
  const nearPins = pins.filter((pin) => close(pin.place));
  const beenPins = nearPins.filter((pin) => been.some(pingOf(pin)));
  // A visit whose pin was deleted since is still a place I've been to.
  const loose = been
    .filter((ping) => close(ping) && !pins.some((pin) => pingOf(pin)(ping)))
    .map((ping): PlaceRef => ({ id: visitPlaceId(ping.id), name: ping.name, center: ping.center, ...(ping.address ? { address: ping.address } : {}), ...(ping.kind ? { kind: ping.kind } : {}) }));
  const first: PlaceRef = { ...(spot ?? { id: `here:${here[0]},${here[1]}` }), name: spot?.name.trim() || HERE_NAME, center: here };

  const ids = new Set<string>();
  const names = new Set<string>();
  const take = (places: readonly PlaceRef[], room: number) => {
    const out: PlaceRef[] = [];
    for (const place of places) {
      if (out.length >= room) break;
      const name = place.name.trim();
      if (!name || ids.has(place.id) || names.has(name)) continue;
      if (isExcluded(place, excluded)) continue;
      ids.add(place.id);
      names.add(name);
      out.push(place);
    }
    return out;
  };
  const visited = take(near([...beenPins.map((p) => p.place), ...loose]), CAMERA_PLACE_LIMIT - 1);
  const others = take([first, ...near(nearPins.map((p) => p.place)), ...near(around)], CAMERA_PLACE_LIMIT - visited.length);
  return { visited, here: isExcluded(first, excluded) ? null : first, others };
}

/** How long a typed place name can be (as a pin's name). */
export const TYPED_PLACE_MAX = 40;

/**
 * 직접 입력 in 위치 선택: a place named by hand, standing on the spot itself —
 * `spot` is `cameraPlaces`' `here`, where I am, carrying the address reverse geocoding found nearest. Null while the name is blank.
 * Its own id, so it never folds into a pin or a place around of the same spot.
 */
export function typedCameraPlace(spot: PlaceRef, name: string): PlaceRef | null {
  const typed = name.trim().slice(0, TYPED_PLACE_MAX);
  if (!typed) return null;
  const { center } = spot;
  return { ...(spot.address ? { address: spot.address } : {}), id: `typed:${center[0]},${center[1]}`, name: typed, center };
}
