import { PIN_ICONS, type PinIcon } from '../types/pin';

/**
 * What kind of place a pin is, independent of any provider's taxonomy and of
 * the icon artwork (docs/plan-auto-icon.md). Every source (Kakao paths, OSM
 * tags, 상가정보 업종 codes, TourAPI) maps into these ids, and only these ids
 * are stored and shared — so they must never be renamed, only added. Redrawing
 * or reassigning an icon is a change to this table alone.
 *
 * Kinds are fine-grained, icons are not: each icon stands for a broad group
 * (식당, 카페·디저트, 가게 …) so a map of 미분류 pins reads at a glance and
 * lines up with the categories people make. `KIND_GROUPS` names the groups.
 */
export const KIND_ICON = {
  // 식당
  restaurant: 'food',
  korean: 'food',
  meat: 'food',
  seafood: 'food',
  chinese: 'food',
  japanese: 'food',
  western: 'food',
  world: 'food',
  noodle: 'food',
  snack: 'food',
  buffet: 'food',
  pizza: 'food',
  burger: 'food',
  chicken: 'food',
  sandwich: 'food',
  // 카페·디저트
  cafe: 'cafe',
  tea: 'cafe',
  bakery: 'cafe',
  donut: 'cafe',
  dessert: 'cafe',
  icecream: 'cafe',
  // 술집
  bar: 'bar',
  pub: 'bar',
  cocktail_bar: 'bar',
  club: 'bar',
  // 가게
  shop: 'shop',
  convenience: 'shop',
  mart: 'shop',
  department_store: 'shop',
  market: 'shop',
  butcher: 'shop',
  fishmonger: 'shop',
  greengrocer: 'shop',
  grocery: 'shop',
  liquor: 'shop',
  drink: 'shop',
  florist: 'shop',
  bookstore: 'shop',
  gift_shop: 'shop',
  jewelry: 'shop',
  music_store: 'shop',
  bike_shop: 'shop',
  pet_shop: 'shop',
  // 숙소
  hotel: 'stay',
  motel: 'stay',
  pension: 'stay',
  camping: 'stay',
  // 운동·레저
  gym: 'dumbbell',
  pool: 'dumbbell',
  bowling: 'dumbbell',
  billiards: 'dumbbell',
  golf: 'dumbbell',
  racket: 'dumbbell',
  fishing: 'dumbbell',
  water_sports: 'dumbbell',
  // 공연·놀거리
  theater: 'theater',
  cinema: 'theater',
  amusement: 'theater',
  karaoke: 'theater',
  comic_cafe: 'theater',
  festival: 'theater',
  // 명소
  attraction: 'photo',
  viewpoint: 'photo',
  landmark: 'photo',
  heritage: 'photo',
  museum: 'photo',
  gallery: 'photo',
  zoo: 'photo',
  aquarium: 'photo',
  // 자연
  park: 'tree',
  garden: 'tree',
  mountain: 'tree',
  beach: 'tree',
  hiking: 'tree',
  // 병원·약국
  hospital: 'hospital',
  clinic: 'hospital',
  pharmacy: 'hospital',
  vet: 'hospital',
  // 미용
  salon: 'salon',
  // 생활 서비스·기관
  laundry: 'building',
  photo_studio: 'building',
  wedding: 'building',
  travel_agency: 'building',
  bank: 'building',
  post: 'building',
  church: 'building',
  temple: 'building',
  // 공부
  school: 'school',
  library: 'school',
  study_cafe: 'school',
  // 차
  gas: 'car',
  car_rental: 'car',
  car_service: 'car',
  parking: 'car',
  // 교통
  station: 'bus',
  bus_stop: 'bus',
  airport: 'bus',
  port: 'bus',
  // 화장실
  restroom: 'restroom',
} as const satisfies Record<string, PinIcon>;

export type PlaceKind = keyof typeof KIND_ICON;

export const PLACE_KINDS = Object.keys(KIND_ICON) as PlaceKind[];

/** The icon groups, in the order above, with a name for each. */
export const KIND_GROUPS: readonly { icon: PinIcon; label: string }[] = [
  { icon: 'food', label: '식당' },
  { icon: 'cafe', label: '카페·디저트' },
  { icon: 'bar', label: '술집' },
  { icon: 'shop', label: '가게' },
  { icon: 'stay', label: '숙소' },
  { icon: 'dumbbell', label: '운동·레저' },
  { icon: 'theater', label: '공연·놀거리' },
  { icon: 'photo', label: '명소' },
  { icon: 'tree', label: '자연' },
  { icon: 'hospital', label: '병원·약국' },
  { icon: 'salon', label: '미용' },
  { icon: 'building', label: '생활 서비스·기관' },
  { icon: 'school', label: '공부' },
  { icon: 'car', label: '차' },
  { icon: 'bus', label: '교통' },
  { icon: 'restroom', label: '화장실' },
];

/** For untrusted input (share links, storage): only known ids pass. */
export const isPlaceKind = (value: unknown): value is PlaceKind =>
  typeof value === 'string' && Object.hasOwn(KIND_ICON, value);

/** Drops a `kind` that isn't one of ours (stored or synced data), keeping everything else. */
export const cleanPlaceKind = <P extends { kind?: unknown }>(place: P): P => {
  if (place.kind === undefined || isPlaceKind(place.kind)) return place;
  const { kind: _dropped, ...rest } = place;
  return rest as P;
};

export const kindIcon = (kind: PlaceKind | null | undefined): PinIcon | null =>
  kind && isPlaceKind(kind) && Object.hasOwn(PIN_ICONS, KIND_ICON[kind]) ? KIND_ICON[kind] : null;
