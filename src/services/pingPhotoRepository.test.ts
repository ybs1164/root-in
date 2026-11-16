import { beforeEach, describe, expect, it } from 'vitest';
import { deletePingPhoto, loadPingPhotos, MAX_PING_PHOTOS, onPingPhotosChanged, savePingPhoto } from './pingPhotoRepository';

const jpeg = (n: number) => `data:image/jpeg;base64,${'A'.repeat(n)}`;
const srcs = (id: string) => (loadPingPhotos()[id] ?? []).map((p) => p.src);

describe('pingPhotoRepository', () => {
  beforeEach(() => window.localStorage.clear());

  it('stacks the photos of a ping, dropping those of pings that are gone', () => {
    let changed = 0;
    const stop = onPingPhotosChanged(() => (changed += 1));
    savePingPhoto('a', jpeg(4), new Set(['a']), new Date('2026-11-16T01:00:00Z'));
    savePingPhoto('b', jpeg(5), new Set(['a', 'b']));
    savePingPhoto('a', jpeg(6), new Set(['a', 'b']), new Date('2026-11-16T02:00:00Z'));
    expect(srcs('a')).toEqual([jpeg(4), jpeg(6)]);
    expect(srcs('b')).toEqual([jpeg(5)]);
    // The first keeps the ping's id (its ★ and comments, as in v1); the next get their own.
    const [first, second] = loadPingPhotos().a;
    expect(first.id).toBe('a');
    expect(second.id).not.toBe('a');
    expect(second.at).toBe('2026-11-16T02:00:00.000Z');
    // 'b' was taken out of its day.
    savePingPhoto('c', jpeg(7), new Set(['a', 'c']));
    expect(Object.keys(loadPingPhotos())).toEqual(['a', 'c']);
    expect(changed).toBe(4);
    stop();
  });

  it('deletes one photo off a stack, the rest staying', () => {
    savePingPhoto('a', jpeg(4), new Set(['a']), new Date('2026-11-16T01:00:00Z'));
    savePingPhoto('a', jpeg(6), new Set(['a']), new Date('2026-11-16T02:00:00Z'));
    deletePingPhoto('a');
    expect(srcs('a')).toEqual([jpeg(6)]);
    deletePingPhoto(loadPingPhotos().a[0].id);
    expect(loadPingPhotos()).toEqual({});
  });

  it('reads v1 (one photo per ping) as a stack of one', () => {
    window.localStorage.setItem('goodroot:ping-photos:v1', JSON.stringify({ ok: jpeg(1), bad: 3 }));
    expect(loadPingPhotos()).toEqual({ ok: [{ id: 'ok', src: jpeg(1) }] });
  });

  it('takes only JPEG data URLs, and keeps the newest when there are too many', () => {
    savePingPhoto('x', 'https://example.com/a.jpg', new Set(['x']));
    expect(loadPingPhotos()).toEqual({});
    const ids = Array.from({ length: MAX_PING_PHOTOS + 3 }, (_, i) => `p${i}`);
    const alive = new Set(ids);
    ids.forEach((id) => savePingPhoto(id, jpeg(2), alive));
    const kept = Object.keys(loadPingPhotos());
    expect(kept).toHaveLength(MAX_PING_PHOTOS);
    expect(kept[0]).toBe('p3');
  });
});
