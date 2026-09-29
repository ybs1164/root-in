import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import { kakaoDirectionsUrl, kakaoPlaceUrl } from './directionsLink';

describe('Kakao Map links', () => {
  it('builds a per-leg directions link with lat,lng order and mode', () => {
    const url = kakaoDirectionsUrl(samplePlaces.onionSeongsu, samplePlaces.seoulForest, 'transit');
    expect(url).toBe(
      `https://map.kakao.com/link/by/traffic/${encodeURIComponent('어니언 성수')},37.5447,127.0582/${encodeURIComponent('서울숲')},37.5444,127.0374`,
    );
  });

  it('strips separators from names so the link stays parseable', () => {
    const place = { ...samplePlaces.seoulForest, name: 'A,B/C' };
    expect(kakaoDirectionsUrl(place, place, 'walk')).toContain(`/${encodeURIComponent('A B C')},`);
  });

  it('links Kakao places to their place page, others to a map pin', () => {
    expect(kakaoPlaceUrl({ ...samplePlaces.seoulForest, id: 'kakao:123' })).toBe('https://place.map.kakao.com/123');
    expect(kakaoPlaceUrl(samplePlaces.seoulForest)).toMatch(/^https:\/\/map\.kakao\.com\/link\/map\//);
  });
});
