import { useRef, useState } from 'react';
import { CAMERA_PLACE_LIMIT, cameraPlaces, type CameraPlaces } from '../domain/cameraPlaces';
import { TODAY_PING_RADIUS_M } from '../domain/dayPings';
import { dateKey } from '../domain/diary';
import { haversineMeters as distanceMeters } from '../domain/geo';
import { isExcluded } from '../domain/privacy';
import { avatarFromDataUrl } from '../lib/avatarImage';
import { PING_PHOTO_PX, savePingPhoto } from '../services/pingPhotoRepository';
import { loadPings, recordPing, recordPlacePing, todayPingOfPin } from '../services/pingRepository';
import { UNNAMED_SPOT, type PlaceSearchService } from '../services/placeSearch/placeSearchService';
import type { PlaceRef } from '../types/course';
import { UNCATEGORIZED } from '../domain/pin';
import type { Pin } from '../types/pin';

interface CameraShot {
  /** Where I am, if known. */
  here: [number, number] | null;
  excluded: Parameters<typeof isExcluded>[1];
  searchService: PlaceSearchService | null;
  pins: Pin[];
  /** Pins a place in a category (null when it can't); changes a pin's category. */
  savePin: (place: PlaceRef, categoryId: string) => { pin: Pin } | null;
  updatePin: (id: string, patch: { categoryId: string }) => void;
  /** Sends the photo with a ping of the place to those groups; how many took it. */
  sendPhoto: (groupIds: string[], ping: { day: string; at: string; center: [number, number]; name: string }, photo: string) => Promise<number>;
  notify: (text: string) => void;
}

/**
 * The camera screen and what it sends: a shot waits for its place and its
 * groups (the 그룹에 보내기 popup), then goes to TODAY and to the groups picked.
 */
export function useCameraShot({ here, excluded, searchService, pins, savePin, updatePin, sendPhoto, notify }: CameraShot) {
  const [open, setOpen] = useState(false);
  // The group the camera was opened from: picked to send to, to start with (can be unpicked).
  const [groupId, setGroupId] = useState<string | null>(null);
  // A shot from the camera waiting for its groups (the 그룹에 보내기 popup is up).
  const [shot, setShot] = useState<string | null>(null);
  // When it was taken: the photo ping's time (and day) is the shutter's, not 전송's.
  const shotAt = useRef(new Date());
  // Where that shot can say it was taken (null while still looking), or why there's nowhere.
  const [spots, setSpots] = useState<{ places: CameraPlaces | null; problem: string | null }>({ places: null, problem: null });
  const nowhere: CameraPlaces = { visited: [], here: null, others: [] };
  const lookup = useRef(0);

  // 전송 from the camera, first: the places around where I am, for the shot
  // to say where it was taken (CameraPlaces). Never from near a 제외 주소 (as
  // pings there never leave the phone). Only the latest lookup lands.
  const findSpots = async () => {
    const turn = ++lookup.current;
    const center = here;
    if (!center) return setSpots({ places: nowhere, problem: '지금 위치를 찾지 못했어요. 위치 권한을 확인해 주세요.' });
    if (isExcluded({ center }, excluded)) return setSpots({ places: nowhere, problem: '제외 주소 근처에서는 보낼 수 없어요.' });
    setSpots({ places: null, problem: null });
    const [named, around] = await Promise.all([
      searchService?.reverse(center) ?? null,
      searchService?.nearby(center, { limit: CAMERA_PLACE_LIMIT }) ?? [],
    ]);
    if (turn !== lookup.current) return;
    const places = cameraPlaces(center, named && named.name !== UNNAMED_SPOT ? named : null, pins, around, excluded, loadPings());
    setSpots({ places, problem: places.visited.length + places.others.length ? null : '제외 주소 근처에서는 보낼 수 없어요.' });
  };

  // TODAY (MY) in the send popup: the shot pings the picked place on my own
  // day, with the photo on it — my pin there if it is one (once a day, so a
  // second shot only adds the photo), else today's ping of the same place
  // within 50m, else a new ping of the place.
  const pingOnToday = async (photo: string, place: PlaceRef, pin: Pin | undefined): Promise<boolean> => {
    const small = await avatarFromDataUrl(photo, PING_PHOTO_PX, 0.8);
    let pingId: string | null;
    if (pin) {
      recordPing(pin, excluded);
      pingId = todayPingOfPin(pin.id);
    } else {
      const today = dateKey();
      pingId =
        loadPings().find((p) => p.day === today && !p.pinId && p.name === place.name && distanceMeters(p.center, place.center) <= TODAY_PING_RADIUS_M)?.id ??
        recordPlacePing(place, excluded);
    }
    if (!pingId) return false;
    if (small) savePingPhoto(pingId, small, new Set(loadPings().map((p) => p.id)));
    return true;
  };

  // Then the photo and a ping of the place picked to each picked group. What went wrong, or null.
  // TODAY always gets the shot (the gallery's MY is TODAY's photos); the groups are extra.
  // The category picked in 위치 선택 lands with the ping: my pin there moves
  // to it; no pin yet, one is made in it (and the ping recorded from it).
  // 미분류 with no pin changes nothing — the visit becomes a 미분류 pin anyway.
  const pinIn = (place: PlaceRef, categoryId: string): Pin | undefined => {
    const pin = pins.find((p) => p.place.id === place.id);
    if (pin) {
      if (pin.categoryId !== categoryId) updatePin(pin.id, { categoryId });
      return pin;
    }
    if (categoryId === UNCATEGORIZED.id) return undefined;
    return savePin(place, categoryId)?.pin;
  };

  const send = async (groupIds: string[], place: PlaceRef, categoryId: string = UNCATEGORIZED.id): Promise<string | null> => {
    if (!shot) return '보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
    if (isExcluded(place, excluded)) return '제외 주소 근처에서는 보낼 수 없어요.';
    const sent = groupIds.length ? await sendPhoto(groupIds, { day: dateKey(shotAt.current), at: shotAt.current.toISOString(), center: place.center, name: place.name }, shot) : 0;
    if (groupIds.length && !sent) return '보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
    const pinged = await pingOnToday(shot, place, pinIn(place, categoryId));
    if (!pinged && !sent) return 'TODAY에 핑을 찍지 못했어요.';
    setShot(null);
    setOpen(false);
    notify(sent ? (pinged ? `TODAY와 ${sent}개 그룹에 보냈어요.` : sent === 1 ? '그룹에 보냈어요.' : `${sent}개 그룹에 보냈어요.`) : `'${place.name}' 핑을 TODAY에 찍었어요.`);
    return null;
  };

  return {
    open,
    groupId,
    shot,
    spots,
    /** Opens the camera; from a group's map that group starts picked. */
    openFrom: (group: string | null) => {
      setGroupId(group);
      setOpen(true);
    },
    close: () => setOpen(false),
    /** 전송 on the camera screen: the shot waits for its place and groups. */
    take: (photo: string, takenAt: Date) => {
      shotAt.current = takenAt;
      setShot(photo);
      void findSpots();
    },
    send,
    /** The send popup closed without sending: back to the camera. */
    dropShot: () => {
      lookup.current++;
      setShot(null);
    },
  };
}
