import { describe, expect, it } from 'vitest';
import { dayPosters, galleryDayLabel, galleryDays, galleryTabDays, localGalleryPhotos, viewerOrder, type GalleryPhoto } from './gallery';
import type { StoredPing } from './dayPings';

const photo = (id: string, groupId: string, day: string, time: string, path = `p/${id}`): GalleryPhoto => ({
  id, groupId, userId: 'u', day, at: `${day}T${time}:00.000Z`, name: id, path, url: `https://cdn/${path}`,
});

describe('galleryDays', () => {
  it('groups by day, newest day and newest photo first', () => {
    const days = galleryDays([photo('a', 'g1', '2026-10-26', '03:00'), photo('b', 'g1', '2026-10-28', '01:00'), photo('c', 'g1', '2026-10-28', '05:00')]);
    expect(days.map((d) => d.day)).toEqual(['2026-10-28', '2026-10-26']);
    expect(days[0].photos.map((p) => p.id)).toEqual(['c', 'b']);
  });

  it('lists one upload sent to several groups once, with every group', () => {
    const days = galleryDays([photo('a', 'g1', '2026-10-28', '03:00', 'same'), photo('b', 'g2', '2026-10-28', '03:00', 'same')]);
    expect(days[0].photos).toHaveLength(1);
    expect(days[0].photos[0].groupIds).toEqual(['g1', 'g2']);
  });
});

describe('galleryDayLabel', () => {
  it('reads TODAY, a date (no weekday), and the year only when another', () => {
    expect(galleryDayLabel('2026-10-28', '2026-10-28')).toBe('TODAY');
    expect(galleryDayLabel('2026-10-27', '2026-10-28')).toBe('10.27');
    expect(galleryDayLabel('2025-12-31', '2026-10-28')).toBe('2025.12.31');
  });

  it("lists a day's posters once each, the first to post first", () => {
    const [day] = galleryDays([
      { ...photo('a', 'g', '2026-10-28', '05:00'), userId: 'u2' },
      { ...photo('b', 'g', '2026-10-28', '01:00'), userId: 'u1' },
      { ...photo('c', 'g', '2026-10-28', '03:00'), userId: 'u2' },
    ]);
    expect(dayPosters(day.photos)).toEqual(['u1', 'u2']);
  });
});

describe('gallery tabs', () => {
  const mine = { ...photo('m', 'g1', '2026-10-27', '03:00', 'up/m'), userId: 'me' };
  const mineToo = { ...mine, id: 'm2', groupId: 'g2' };
  const theirs = photo('t', 'g2', '2026-10-28', '04:00');
  const stored: StoredPing[] = [
    { id: 'p1', day: '2026-10-28', at: '2026-10-28T01:00:00.000Z', name: '서촌', center: [127, 37.5] },
    { id: 'p2', day: '2026-10-28', at: '2026-10-28T02:00:00.000Z', name: '사진 없음', center: [127, 37.5] },
  ];
  const local = localGalleryPhotos(stored, { p1: 'data:image/jpeg;base64,AA' }, 'me');

  it("MY is what I sent (once, with every group) and TODAY's own photos; a group's tab is everything sent there", () => {
    expect(local.map((p) => p.name)).toEqual(['서촌']);
    const my = galleryTabDays('my', [mine, mineToo, theirs], 'me', local);
    expect(my.flatMap((d) => d.photos.map((p) => [p.name, p.groupIds]))).toEqual([['서촌', []], ['m', ['g1', 'g2']]]);
    expect(galleryTabDays('g2', [mine, mineToo, theirs], 'me', local).flatMap((d) => d.photos.map((p) => p.id))).toEqual(['t', 'm2']);
    expect(galleryTabDays('my', [mine], null, []).length).toBe(0);
  });

  it('pages the viewer oldest first, the newest last, across days', () => {
    const days = galleryDays([photo('a', 'g', '2026-10-27', '01:00'), photo('b', 'g', '2026-10-28', '01:00'), photo('c', 'g', '2026-10-28', '05:00')]);
    expect(viewerOrder(days).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});
