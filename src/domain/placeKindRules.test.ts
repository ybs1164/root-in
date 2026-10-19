import { describe, expect, it } from 'vitest';
import { kindFromKakao, kindFromOsm } from './placeKindRules';

describe('kindFromKakao', () => {
  it.each([
    ['음식점 > 카페 > 커피전문점 > 스타벅스', 'cafe'],
    ['음식점 > 카페 > 베이커리카페', 'bakery'],
    ['음식점 > 카페 > 디저트카페 > 설빙', 'dessert'], // brand skipped,
    ['음식점 > 카페 > 테마카페 > 만화카페', 'comic_cafe'],
    ['음식점 > 한식 > 육류,고기 > 삼겹살', 'meat'],
    ['음식점 > 한식 > 해물,생선 > 회', 'seafood'],
    ['음식점 > 한식 > 국수', 'noodle'],
    ['음식점 > 한식', 'korean'],
    ['음식점 > 중식 > 중국요리', 'chinese'],
    ['음식점 > 일식 > 초밥,롤', 'japanese'],
    ['음식점 > 양식 > 피자 > 도미노피자', 'pizza'],
    ['음식점 > 패스트푸드 > 맥도날드', 'restaurant'],
    ['음식점 > 치킨 > BBQ치킨', 'chicken'],
    ['음식점 > 술집 > 호프,요리주점', 'pub'],
    ['음식점 > 술집 > 칵테일바', 'cocktail_bar'],
    ['음식점', 'restaurant'],
    ['가정,생활 > 편의점 > GS25', 'convenience'],
    ['여행 > 공원 > 도시근린공원', 'park'],
    ['여행 > 관광,명소 > 산', 'mountain'],
    ['여행 > 관광,명소 > 해수욕장,해변', 'beach'],
    ['여행 > 관광,명소 > 문화유적 > 고궁', 'heritage'],
    ['여행 > 관광,명소 > 테마거리', 'attraction'],
    ['여행 > 숙박 > 호텔 > 특급호텔', 'hotel'],
    ['문화,예술 > 영화,영상 > 영화관 > CGV', 'cinema'],
    ['교통,수송 > 지하철,전철 > 수도권2호선', 'station'],
    ['종교 > 불교 > 사찰', 'temple'],
    ['의료,건강 > 병원 > 치과', 'clinic'],
    ['서비스,산업 > 미용 > 미용실', 'salon'],
  ])('%s → %s', (path, kind) => {
    expect(kindFromKakao(path)).toBe(kind);
  });

  it('falls back to the category group, then to null', () => {
    expect(kindFromKakao('가정,생활 > 생활용품점', 'MT1')).toBe('mart');
    expect(kindFromKakao('부동산 > 중개업소', 'AG2')).toBeNull();
    expect(kindFromKakao('', undefined)).toBeNull();
    expect(kindFromKakao(undefined, 'CE7')).toBe('cafe');
  });
});

describe('kindFromOsm', () => {
  it('maps known key=value pairs only', () => {
    expect(kindFromOsm('amenity', 'cafe')).toBe('cafe');
    expect(kindFromOsm('leisure', 'park')).toBe('park');
    expect(kindFromOsm('natural', 'peak')).toBe('mountain');
    expect(kindFromOsm('shop', 'clothes')).toBe('shop');
    expect(kindFromOsm('shop', 'wholesale')).toBeNull();
    expect(kindFromOsm('amenity', 'toString')).toBeNull();
    expect(kindFromOsm('constructor', 'name')).toBeNull();
    expect(kindFromOsm(undefined, 'cafe')).toBeNull();
  });
});
