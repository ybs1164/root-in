import { beforeEach, describe, expect, it } from 'vitest';
import { loadPingPhotos, MAX_PING_PHOTOS, onPingPhotosChanged, savePingPhoto } from './pingPhotoRepository';

const jpeg = (n: number) => `data:image/jpeg;base64,${'A'.repeat(n)}`;

describe('pingPhotoRepository', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps one photo per ping, dropping those of pings that are gone', () => {
    let changed = 0;
    const stop = onPingPhotosChanged(() => (changed += 1));
    savePingPhoto('a', jpeg(4), new Set(['a']));
    savePingPhoto('b', jpeg(5), new Set(['a', 'b']));
    savePingPhoto('a', jpeg(6), new Set(['a', 'b']));
    expect(loadPingPhotos()).toEqual({ b: jpeg(5), a: jpeg(6) });
    // 'b' was taken out of its day.
    savePingPhoto('c', jpeg(7), new Set(['a', 'c']));
    expect(Object.keys(loadPingPhotos())).toEqual(['a', 'c']);
    expect(changed).toBe(4);
    stop();
  });

  it("takes only JPEG data URLs, and keeps the newest when there are too many", () => {
    savePingPhoto('x', 'https://example.com/a.jpg', new Set(['x']));
    expect(loadPingPhotos()).toEqual({});
    const ids = Array.from({ length: MAX_PING_PHOTOS + 3 }, (_, i) => `p${i}`);
    const alive = new Set(ids);
    ids.forEach((id) => savePingPhoto(id, jpeg(2), alive));
    const kept = Object.keys(loadPingPhotos());
    expect(kept).toHaveLength(MAX_PING_PHOTOS);
    expect(kept[0]).toBe('p3');
    window.localStorage.setItem('goodroot:ping-photos:v1', JSON.stringify({ ok: jpeg(1), bad: 3 }));
    expect(loadPingPhotos()).toEqual({ ok: jpeg(1) });
  });
});
