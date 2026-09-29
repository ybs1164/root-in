import { describe, expect, it } from 'vitest';
import { SAMPLE_CURATORS } from '../data/curators';
import { decodeSharedCourse, encodeSharedCourse } from './courseShareService';
import { StaticCuratorFeed } from './curatorFeedService';
import { decodeSharedPinSet, encodeSharedPinSet } from './pinShareService';

describe('추천 feed (prototype)', () => {
  it('StaticCuratorFeed lists sample curators; a failing feed yields an empty list', async () => {
    expect((await new StaticCuratorFeed().list()).length).toBeGreaterThan(0);
    const failing = new StaticCuratorFeed(() => {
      throw new Error('offline');
    });
    expect(await failing.list()).toEqual([]);
    expect(await new StaticCuratorFeed(() => Promise.reject(new Error('x'))).list()).toEqual([]);
  });

  it('a curator course can be saved to my courses via the shared-course view', () => {
    // The tab opens items as share links, so every sample must survive the
    // same encoder + untrusted-link decoder a real link goes through.
    for (const curator of SAMPLE_CURATORS) {
      for (const item of curator.items) {
        if (item.kind === 'course') {
          expect(decodeSharedCourse(encodeSharedCourse(item.course).token)).toMatchObject({
            title: item.course.title,
            stops: item.course.stops,
          });
        } else {
          expect(decodeSharedPinSet(encodeSharedPinSet(item.pins).token)).toEqual(item.pins);
        }
      }
    }
  });
});
