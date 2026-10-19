import { PIN_ICONS, type PinIcon } from '../types/pin';

/**
 * What kind of place a pin is, independent of any provider's taxonomy and of
 * the icon artwork (docs/plan-auto-icon.md). Every source (Kakao paths, OSM
 * tags, 상가정보 업종 codes, TourAPI) maps into these ids, and only these ids
 * are stored and shared — so they must never be renamed, only added. Redrawing
 * or reassigning an icon is a change to this table alone.
 */
export const KIND_ICON = {
  // Food & drink
  restaurant: 'food', // generic / 백반·한정식
  korean: 'food',
  meat: 'food',
  seafood: 'fish',
  chinese: 'noodles',
  japanese: 'sushi',
  western: 'food',
  world: 'food',
  noodle: 'noodles',
  snack: 'food', // 김밥·분식
  buffet: 'food',
  pizza: 'pizza',
  burger: 'burger',
  chicken: 'chicken',
  sandwich: 'sandwich',
  bakery: 'bread',
  donut: 'donut',
  dessert: 'cake',
  icecream: 'icecream',
  cafe: 'cafe',
  tea: 'tea',
  bar: 'bar',
  pub: 'beer',
  cocktail_bar: 'cocktail',
  club: 'music',
  // Shops
  shop: 'shop',
  convenience: 'store',
  mart: 'shop',
  department_store: 'shop',
  market: 'shop', // 전통시장
  butcher: 'shop',
  fishmonger: 'fish',
  greengrocer: 'apple',
  grocery: 'shop',
  liquor: 'beer',
  drink: 'drink',
  florist: 'flower',
  bookstore: 'book',
  gift_shop: 'gift',
  jewelry: 'gift',
  music_store: 'music',
  bike_shop: 'bike',
  pet_shop: 'paw',
  pharmacy: 'hospital',
  gas: 'gas',
  // Stay
  hotel: 'stay',
  motel: 'stay',
  pension: 'stay',
  camping: 'tent',
  // Sports & leisure
  gym: 'dumbbell',
  pool: 'swim',
  bowling: 'bowling',
  billiards: 'ball',
  golf: 'golf',
  racket: 'tennis',
  hiking: 'hiking',
  karaoke: 'music',
  comic_cafe: 'book',
  study_cafe: 'book',
  fishing: 'fish',
  water_sports: 'ship',
  // Services
  salon: 'salon',
  laundry: 'laundry',
  wedding: 'heart',
  photo_studio: 'photo',
  vet: 'paw',
  travel_agency: 'plane',
  car_rental: 'car',
  car_service: 'car',
  hospital: 'hospital',
  clinic: 'hospital',
  bank: 'bank',
  post: 'post',
  // Culture & sights (not in 상가정보 — Kakao, OSM, TourAPI, 표준데이터)
  attraction: 'photo',
  viewpoint: 'photo',
  landmark: 'flag',
  heritage: 'building',
  museum: 'building',
  gallery: 'photo',
  theater: 'theater',
  cinema: 'cinema',
  amusement: 'amusement',
  zoo: 'paw',
  aquarium: 'fish',
  library: 'book',
  school: 'school',
  church: 'church',
  temple: 'building',
  festival: 'star',
  // Nature
  park: 'tree',
  garden: 'flower',
  mountain: 'mountain',
  beach: 'palm',
  // Getting around
  station: 'train',
  bus_stop: 'bus',
  airport: 'plane',
  port: 'ship',
  parking: 'parking',
  restroom: 'restroom',
} as const satisfies Record<string, PinIcon>;

export type PlaceKind = keyof typeof KIND_ICON;

export const PLACE_KINDS = Object.keys(KIND_ICON) as PlaceKind[];

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
