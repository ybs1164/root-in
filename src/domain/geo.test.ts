import { describe, expect, it } from 'vitest';
import { samplePlaces } from '../test/fixtures';
import { estimateCourse, estimateLeg, formatMeters, formatMinutes, haversineMeters } from './geo';

const { onionSeongsu, seoulForest, haeundae, gamcheon, euljiroCafe, nogariAlley } = samplePlaces;

describe('distance / time estimates', () => {
  it('haversine is roughly right for a known pair (성수 → 서울숲 ≈ 1.8km)', () => {
    const m = haversineMeters(onionSeongsu.center, seoulForest.center);
    expect(m).toBeGreaterThan(1600);
    expect(m).toBeLessThan(2000);
  });

  it('walking is slower than driving for the same leg', () => {
    const walk = estimateLeg(gamcheon.center, haeundae.center, 'walk');
    const drive = estimateLeg(gamcheon.center, haeundae.center, 'drive');
    expect(walk.minutes).toBeGreaterThan(drive.minutes * 3);
  });

  it('short transit hops are estimated as walking', () => {
    expect(estimateLeg(euljiroCafe.center, nogariAlley.center, 'transit').minutes).toBe(
      estimateLeg(euljiroCafe.center, nogariAlley.center, 'walk').minutes,
    );
  });

  it('estimateCourse sums legs', () => {
    const { legs, total } = estimateCourse([onionSeongsu.center, seoulForest.center, onionSeongsu.center], 'walk');
    expect(legs).toHaveLength(2);
    expect(total.minutes).toBe(legs[0].minutes + legs[1].minutes);
  });

  it('formats for display', () => {
    expect(formatMeters(843)).toBe('840m');
    expect(formatMeters(2345)).toBe('2.3km');
    expect(formatMinutes(45)).toBe('45분');
    expect(formatMinutes(125)).toBe('2시간 5분');
  });
});
