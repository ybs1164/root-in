import type { SharedCourse } from '../types/course';
import type { SharedPinSet } from '../types/pin';

// Prototype content for the 추천(influencer) tab (plan P6). The curators are
// made up — no real person or brand — and the places are well-known public
// spots with approximate coordinates, stored as the same snapshots a share
// link carries. A server feed replaces this file in M3.

export interface Curator {
  id: string;
  name: string;
  emoji: string;
  bio: string;
  items: CuratorItem[];
}

export type CuratorItem =
  | { kind: 'course'; id: string; course: SharedCourse }
  | { kind: 'pins'; id: string; pins: SharedPinSet };

const AT = '2026-09-01T00:00:00.000Z';

export const SAMPLE_CURATORS: Curator[] = [
  {
    id: 'walker',
    name: '골목산책러',
    emoji: '🚶',
    bio: '지도 없이 걷다 발견한 서울 골목',
    items: [
      {
        kind: 'course',
        id: 'walker-seongsu',
        course: {
          title: '성수 반나절 산책',
          theme: 'date',
          travelMode: 'walk',
          stops: [
            { place: { id: 'sample:seoul-forest', name: '서울숲', center: [127.0374, 37.5444], category: '공원' }, memo: '은행나무길부터' },
            { place: { id: 'sample:seongsu-cafe-street', name: '성수동 카페거리', center: [127.0558, 37.5446], category: '거리' } },
            { place: { id: 'sample:ttukseom', name: '뚝섬한강공원', center: [127.0669, 37.5294], category: '공원' }, memo: '해 질 녘 추천' },
          ],
          sharedBy: '골목산책러',
          sharedAt: AT,
        },
      },
      {
        kind: 'course',
        id: 'walker-bukchon',
        course: {
          title: '북촌 · 삼청 한 바퀴',
          theme: 'trip',
          travelMode: 'walk',
          stops: [
            { place: { id: 'sample:anguk', name: '안국역', center: [126.9856, 37.5765], category: '지하철역' } },
            { place: { id: 'sample:bukchon', name: '북촌한옥마을', center: [126.9850, 37.5826], category: '관광명소' } },
            { place: { id: 'sample:samcheong', name: '삼청동길', center: [126.9818, 37.5853], category: '거리' } },
            { place: { id: 'sample:gyeongbok', name: '경복궁', center: [126.9770, 37.5796], category: '고궁' } },
          ],
          sharedBy: '골목산책러',
          sharedAt: AT,
        },
      },
    ],
  },
  {
    id: 'eater',
    name: '노포수집가',
    emoji: '🍜',
    bio: '30년 넘은 가게만 모읍니다',
    items: [
      {
        kind: 'pins',
        id: 'eater-euljiro',
        pins: {
          title: '을지로 · 종로 노포 지도',
          categories: [
            { name: '맛집', icon: 'food', color: 2 },
            { name: '술집', icon: 'bar', color: 3 },
          ],
          pins: [
            { place: { id: 'sample:nogari', name: '을지로 노가리골목', center: [126.9912, 37.566] }, category: 1 },
            { place: { id: 'sample:gwangjang', name: '광장시장', center: [126.9996, 37.5700] }, category: 0, memo: '빈대떡 필수' },
            { place: { id: 'sample:ikseon', name: '익선동 한옥거리', center: [126.9899, 37.5743] }, category: 0 },
            { place: { id: 'sample:euljiro3', name: '을지로3가역', center: [126.9918, 37.5663] }, category: 1 },
          ],
          sharedBy: '노포수집가',
          sharedAt: AT,
        },
      },
      {
        kind: 'course',
        id: 'eater-mangwon',
        course: {
          title: '망원시장 먹방 코스',
          theme: 'food',
          travelMode: 'walk',
          stops: [
            { place: { id: 'sample:mangwon-market', name: '망원시장', center: [126.9061, 37.5561], category: '시장' }, memo: '고로케부터' },
            { place: { id: 'sample:mangwon-park', name: '망원한강공원', center: [126.8949, 37.5548], category: '공원' } },
          ],
          sharedBy: '노포수집가',
          sharedAt: AT,
        },
      },
    ],
  },
  {
    id: 'traveler',
    name: '주말부산',
    emoji: '🌊',
    bio: 'KTX 타고 당일치기',
    items: [
      {
        kind: 'course',
        id: 'traveler-busan',
        course: {
          title: '부산 바다 당일치기',
          theme: 'trip',
          travelMode: 'transit',
          stops: [
            { place: { id: 'sample:gamcheon', name: '감천문화마을', center: [129.0106, 35.0975], category: '관광명소' } },
            { place: { id: 'sample:haeundae', name: '해운대해수욕장', center: [129.1604, 35.1587], category: '해수욕장' } },
            { place: { id: 'sample:gwangalli', name: '광안리해수욕장', center: [129.1186, 35.1532], category: '해수욕장' }, memo: '밤에 광안대교' },
          ],
          sharedBy: '주말부산',
          sharedAt: AT,
        },
      },
    ],
  },
];
