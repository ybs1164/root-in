import type { PlaceRef, SharedRoute } from '../types/travelRoute';

// Real-world spots matching the app's target use cases (date course, food
// tour, trip). Coordinates are approximate but plausible so routing/share
// tests exercise realistic values rather than [0, 0].
export const samplePlaces = {
  onionSeongsu: { id: 'osm:N-onion-seongsu', name: '어니언 성수', center: [127.0582, 37.5447] },
  seoulForest: { id: 'osm:W-seoul-forest', name: '서울숲', center: [127.0374, 37.5444] },
  seongsuGalbi: { id: 'osm:N-seongsu-galbi', name: '성수 갈비집', center: [127.0557, 37.5431] },
  nogariAlley: { id: 'osm:W-nogari-alley', name: '을지로 노가리골목', center: [126.9912, 37.566] },
  euljiroCafe: { id: 'osm:N-euljiro-cafe', name: '을지로 카페', center: [126.9925, 37.5663] },
  haeundae: { id: 'osm:W-haeundae', name: '해운대해수욕장', center: [129.1604, 35.1587] },
  gamcheon: { id: 'osm:W-gamcheon', name: '감천문화마을', center: [129.0106, 35.0975] },
} satisfies Record<string, PlaceRef>;

export const sampleSharedRoute = (overrides: Partial<SharedRoute> = {}): SharedRoute => ({
  origin: samplePlaces.onionSeongsu,
  destination: samplePlaces.seoulForest,
  title: '성수 데이트 코스',
  note: '카페에서 브런치 먹고 서울숲 산책 🌳',
  sharedBy: '지우',
  sharedAt: '2026-09-28T03:00:00.000Z',
  ...overrides,
});

/** Ordered stop lists for the upcoming multi-stop Course model (plan 1.1). */
export const sampleCourses = {
  seongsuDate: {
    title: '성수 데이트 코스',
    theme: 'date',
    travelMode: 'walk',
    stops: [samplePlaces.onionSeongsu, samplePlaces.seongsuGalbi, samplePlaces.seoulForest],
  },
  euljiroFood: {
    title: '을지로 노포 투어',
    theme: 'food',
    travelMode: 'walk',
    stops: [samplePlaces.euljiroCafe, samplePlaces.nogariAlley],
  },
  busanTrip: {
    title: '부산 1일 여행',
    theme: 'trip',
    travelMode: 'drive',
    stops: [samplePlaces.gamcheon, samplePlaces.haeundae],
  },
} as const;
