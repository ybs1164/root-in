import type { PlaceKind } from './placeKinds';

// Provider taxonomies → PlaceKind (docs/plan-auto-icon.md, I2). Unknown input
// gives null: a general pin beats a wrong icon.

/**
 * Kakao path segments ("음식점 > 카페 > 커피전문점 > 스타벅스"). Each pattern is
 * tested against one whole segment, deepest first, so the most specific known
 * segment wins and brand names at the end are simply skipped.
 */
const KAKAO_SEGMENTS: [RegExp, PlaceKind][] = [
  // Food
  [/베이커리|제과/, 'bakery'],
  [/^도넛/, 'donut'],
  [/아이스크림|빙수/, 'icecream'],
  [/^떡|디저트|케이크/, 'dessert'],
  [/찻집|^차$|티하우스/, 'tea'],
  // Before the generic café rule: these are cafés by name only.
  [/만화카페|만화방/, 'comic_cafe'],
  [/스터디카페|독서실/, 'study_cafe'],
  [/카페|커피/, 'cafe'],
  [/^피자/, 'pizza'],
  [/햄버거|버거/, 'burger'],
  [/^치킨|닭강정/, 'chicken'],
  [/샌드위치|토스트|샐러드/, 'sandwich'],
  [/^분식|김밥|떡볶이/, 'snack'],
  [/초밥|^일식|돈까스|일본식라면|우동|이자카야$/, 'japanese'],
  [/국수|냉면|칼국수|라면/, 'noodle'],
  [/^중식|중국요리|마라탕|훠궈/, 'chinese'],
  [/해물|생선|^회$|횟집|참치회|조개|게,대게|장어/, 'seafood'],
  [/육류|고기|삼겹살|갈비|곱창|막창|족발|보쌈|오리|닭요리/, 'meat'],
  [/^한식|한정식|국밥|해장국|찌개|전골|백반|감자탕|설렁탕/, 'korean'],
  [/^양식|이탈리안|프랑스음식|스테이크|패밀리레스토랑/, 'western'],
  [/아시아음식|베트남|태국|인도음식|멕시칸|퓨전/, 'world'],
  [/^뷔페/, 'buffet'],
  [/칵테일바|^바$/, 'cocktail_bar'],
  [/호프|맥주|^펍/, 'pub'],
  [/^술집|요리주점|와인바|포장마차|이자카야/, 'bar'],
  [/^음식점$|패스트푸드|도시락|샤브샤브/, 'restaurant'],
  // Shops
  [/^편의점/, 'convenience'],
  [/대형마트|^슈퍼마켓/, 'mart'],
  [/백화점|쇼핑몰|아울렛/, 'department_store'],
  [/전통시장|^시장$/, 'market'],
  [/^꽃집|꽃배달/, 'florist'],
  [/^서점|책방/, 'bookstore'],
  [/기념품|선물/, 'gift_shop'],
  [/^약국/, 'pharmacy'],
  [/주유소|충전소/, 'gas'],
  [/^패션|의류|신발|화장품|안경/, 'shop'],
  // Stay
  [/호텔|리조트/, 'hotel'],
  [/모텔|여관/, 'motel'],
  [/펜션|게스트하우스|민박/, 'pension'],
  [/캠핑|글램핑|야영/, 'camping'],
  // Sports & leisure
  [/헬스|피트니스|요가|필라테스/, 'gym'],
  [/수영장/, 'pool'],
  [/볼링/, 'bowling'],
  [/당구/, 'billiards'],
  [/골프/, 'golf'],
  [/테니스|탁구|스쿼시/, 'racket'],
  [/등산로/, 'hiking'],
  [/노래방|코인노래/, 'karaoke'],
  [/낚시/, 'fishing'],
  [/수상레저|서핑|요트/, 'water_sports'],
  // Services
  [/미용실|헤어|네일|피부관리/, 'salon'],
  [/세탁|빨래방/, 'laundry'],
  [/예식장|웨딩홀/, 'wedding'],
  [/사진관|사진스튜디오|셀프사진/, 'photo_studio'],
  [/동물병원/, 'vet'],
  [/^여행사/, 'travel_agency'],
  [/렌터카|렌트카/, 'car_rental'],
  [/세차|자동차정비|카센터/, 'car_service'],
  [/종합병원|대학병원|^병원$/, 'hospital'],
  [/의원$|치과|한의원|내과|소아과|이비인후과|피부과|안과/, 'clinic'],
  [/^은행|ATM/, 'bank'],
  [/우체국/, 'post'],
  // Culture & sights
  [/전망대/, 'viewpoint'],
  [/문화유적|고궁|^궁$|성곽|유적지|문화재/, 'heritage'],
  [/박물관|기념관/, 'museum'],
  [/미술관|갤러리|화랑/, 'gallery'],
  [/공연장|연극극장|극장$/, 'theater'],
  [/영화관/, 'cinema'],
  [/테마파크|놀이공원|워터파크/, 'amusement'],
  [/동물원/, 'zoo'],
  [/아쿠아리움|수족관/, 'aquarium'],
  [/도서관/, 'library'],
  [/학교$|대학교/, 'school'],
  [/교회|성당/, 'church'],
  [/사찰|^절$/, 'temple'],
  [/축제/, 'festival'],
  [/^관광,명소|관광지/, 'attraction'],
  // Nature
  [/공원/, 'park'],
  [/정원|수목원|식물원/, 'garden'],
  [/^산$|오름|봉우리/, 'mountain'],
  [/해수욕장|해변/, 'beach'],
  // Getting around
  [/지하철|전철|기차역|^역$|KTX/, 'station'],
  [/버스정류장|버스터미널|시외버스/, 'bus_stop'],
  [/공항/, 'airport'],
  [/여객터미널|항구|선착장/, 'port'],
  [/주차장/, 'parking'],
  [/화장실/, 'restroom'],
];

/** Last resort when no path segment is known: Kakao's coarse category group. */
const KAKAO_GROUPS: Record<string, PlaceKind> = {
  CE7: 'cafe',
  FD6: 'restaurant',
  AT4: 'attraction',
  CS2: 'convenience',
  MT1: 'mart',
  OL7: 'gas',
  SW8: 'station',
  BK9: 'bank',
  HP8: 'hospital',
  PM9: 'pharmacy',
  PK6: 'parking',
  AD5: 'hotel',
  SC4: 'school',
};

export const kindFromKakao = (categoryName: string | undefined, groupCode?: string): PlaceKind | null => {
  const segments = (categoryName ?? '').split('>').map((s) => s.trim()).filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const hit = KAKAO_SEGMENTS.find(([pattern]) => pattern.test(segments[i]));
    if (hit) return hit[1];
  }
  return (groupCode && KAKAO_GROUPS[groupCode]) || null;
};

/** OSM `key=value` pairs as Photon reports them (osm_key, osm_value). */
const OSM_TAGS: Record<string, Record<string, PlaceKind>> = {
  amenity: {
    cafe: 'cafe', restaurant: 'restaurant', fast_food: 'restaurant', food_court: 'restaurant',
    bar: 'bar', pub: 'pub', biergarten: 'pub', nightclub: 'club', ice_cream: 'icecream',
    fuel: 'gas', charging_station: 'gas', bank: 'bank', atm: 'bank', post_office: 'post',
    pharmacy: 'pharmacy', hospital: 'hospital', clinic: 'clinic', doctors: 'clinic', dentist: 'clinic',
    veterinary: 'vet', parking: 'parking', toilets: 'restroom', cinema: 'cinema', theatre: 'theater',
    arts_centre: 'gallery', library: 'library', school: 'school', university: 'school', college: 'school',
    karaoke_box: 'karaoke', bus_station: 'bus_stop', ferry_terminal: 'port', marketplace: 'market',
    car_rental: 'car_rental', car_wash: 'car_service',
  },
  shop: {
    convenience: 'convenience', supermarket: 'mart', department_store: 'department_store', mall: 'department_store',
    bakery: 'bakery', pastry: 'dessert', confectionery: 'dessert', butcher: 'butcher', greengrocer: 'greengrocer',
    seafood: 'fishmonger', alcohol: 'liquor', beverages: 'drink', florist: 'florist', books: 'bookstore',
    gift: 'gift_shop', toys: 'gift_shop', jewelry: 'jewelry', musical_instrument: 'music_store', music: 'music_store',
    bicycle: 'bike_shop', pet: 'pet_shop', hairdresser: 'salon', beauty: 'salon', laundry: 'laundry',
    dry_cleaning: 'laundry', travel_agency: 'travel_agency', car_repair: 'car_service',
    clothes: 'shop', shoes: 'shop', bag: 'shop', cosmetics: 'shop', optician: 'shop', boutique: 'shop',
    fashion_accessories: 'shop', stationery: 'shop', second_hand: 'shop', variety_store: 'shop',
  },
  tourism: {
    hotel: 'hotel', hostel: 'hotel', motel: 'motel', guest_house: 'pension', chalet: 'pension',
    camp_site: 'camping', attraction: 'attraction', viewpoint: 'viewpoint', museum: 'museum',
    gallery: 'gallery', theme_park: 'amusement', zoo: 'zoo', aquarium: 'aquarium', artwork: 'landmark',
  },
  leisure: {
    park: 'park', garden: 'garden', fitness_centre: 'gym', sports_centre: 'gym', swimming_pool: 'pool',
    water_park: 'amusement', golf_course: 'golf', bowling_alley: 'bowling', beach_resort: 'beach',
  },
  natural: { peak: 'mountain', beach: 'beach' },
  historic: {
    castle: 'heritage', palace: 'heritage', monument: 'landmark', memorial: 'landmark',
    archaeological_site: 'heritage', ruins: 'heritage', city_gate: 'heritage', building: 'heritage',
  },
  railway: { station: 'station', halt: 'station', subway_entrance: 'station' },
  public_transport: { station: 'station' },
  highway: { bus_stop: 'bus_stop' },
  aeroway: { aerodrome: 'airport', terminal: 'airport' },
};

export const kindFromOsm = (key: string | undefined, value: string | undefined): PlaceKind | null =>
  (key && value && Object.hasOwn(OSM_TAGS, key) && Object.hasOwn(OSM_TAGS[key], value) && OSM_TAGS[key][value]) || null;
