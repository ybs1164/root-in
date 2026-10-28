import { describe, expect, it } from 'vitest';
import { galleryDayLabel, galleryDays, type GalleryPhoto } from './gallery';

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
  it('reads TODAY, a date with its weekday, and the year only when another', () => {
    expect(galleryDayLabel('2026-10-28', '2026-10-28')).toBe('TODAY');
    expect(galleryDayLabel('2026-10-27', '2026-10-28')).toBe('10.27 화');
    expect(galleryDayLabel('2025-12-31', '2026-10-28')).toBe('2025.12.31 수');
  });
});
