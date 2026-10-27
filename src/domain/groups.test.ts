import { describe, expect, it } from 'vitest';
import { stepMember, cleanGroupName, focusPoints, groupPingCount, memberColor, memberInitial, neighborGroup, tilePaths, newPingCount, newMemberPings, photoLimit, photoPings, passRoute, viewerStep, groupPingKey, groupPingKeys, myGroupPings, withSentPhotos, type Group } from './groups';

const member = (userId: string, slot: number, pings: [number, number][]) => ({
  userId,
  slot,
  nickname: `n${slot}`,
  alias: null,
  photo: null,
  pings: pings.map((center, i) => ({ at: `2026-10-16T0${i}:00:00.000Z`, center })),
});

const group = (id: string, members = [member('a', 0, [[126.9, 37.5], [127.0, 37.6]]), member('b', 1, [[126.95, 37.55]])]): Group => ({
  id,
  name: id,
  cover: 0,
  inviteSlug: 'abcdefgh',
  mine: true,
  members,
});

describe('groups', () => {
  it('colours members by slot from the pin palette, repeating past eight', () => {
    expect(memberColor(0)).toBe('var(--pin-1)');
    expect(memberColor(7)).toBe('var(--pin-8)');
    expect(memberColor(8)).toBe('var(--pin-1)');
  });

  it("takes a nickname's first letter (a whole character, not half of one)", () => {
    expect(memberInitial(' 민수')).toBe('민');
    expect(memberInitial('😀x')).toBe('😀');
    expect(memberInitial('')).toBe('?');
  });

  it('trims and caps group names', () => {
    expect(cleanGroupName('  대학 동기  ')).toBe('대학 동기');
    expect(cleanGroupName('가'.repeat(30))).toHaveLength(12);
  });

  it('counts pings and picks the points to fit (one member or all)', () => {
    const g = group('g');
    expect(groupPingCount(g)).toBe(3);
    expect(focusPoints(g, null)).toHaveLength(3);
    expect(focusPoints(g, 'b')).toEqual([[126.95, 37.55]]);
  });

  it('steps to the neighbouring group, going round at the ends', () => {
    const list = [group('x'), group('y'), group('z')];
    expect(neighborGroup(list, 'x', -1)?.id).toBe('z');
    expect(neighborGroup(list, 'z', 1)?.id).toBe('x');
    expect(neighborGroup([group('x')], 'x', 1)).toBeNull();
  });

  it('fits the tile map inside its margin with north up', () => {
    const paths = tilePaths(group('g'), 100);
    expect(paths).toHaveLength(2);
    const all = paths.flatMap((p) => p.points);
    for (const [x, y] of all) {
      expect(x).toBeGreaterThanOrEqual(15);
      expect(x).toBeLessThanOrEqual(85);
      expect(y).toBeGreaterThanOrEqual(15);
      expect(y).toBeLessThanOrEqual(85);
    }
    // The northern ping (37.6) is drawn higher (smaller y) than the southern one.
    expect(paths[0].points[1][1]).toBeLessThan(paths[0].points[0][1]);
    expect(tilePaths(group('e', []), 100)).toEqual([]);
  });

  it('steps through the members only, going round, never to ALL', () => {
    const g = group('g');
    expect(stepMember(g, null, 1)).toBe('a');
    expect(stepMember(g, 'a', 1)).toBe('b');
    expect(stepMember(g, 'b', 1)).toBe('a');
    expect(stepMember(g, 'a', -1)).toBe('b');
    expect(stepMember(g, null, -1)).toBe('b');
    expect(stepMember(g, 'gone', 1)).toBe('a');
    expect(stepMember(group('e', []), null, 1)).toBeNull();
  });
});


describe('newPingCount', () => {
  const group = (pings: Record<string, string[]>): Group => ({
    id: 'g',
    name: 'g',
    cover: 0,
    inviteSlug: 's',
    mine: false,
    members: Object.entries(pings).map(([userId, ats], slot) => ({ userId, slot, nickname: userId, alias: null, photo: null, pings: ats.map((at) => ({ at, center: [127, 37.5] as [number, number] })) })),
  });

  it('counts other members\' pings that were not there when I opened the group', () => {
    const before = group({ me: ['a'], ann: ['b'], bo: [] });
    const seen = groupPingKeys(before);
    expect(newPingCount(before, 'me', seen)).toBe(0);
    const after = group({ me: ['a', 'c'], ann: ['b', 'd'], bo: ['e'] });
    expect(newPingCount(after, 'me', seen)).toBe(2); // mine (c) never counts
  });

  it('a group never opened counts all of their pings', () => {
    expect(newPingCount(group({ me: ['a'], ann: ['b', 'c'] }), 'me', undefined)).toBe(2);
  });
});

describe('withSentPhotos', () => {
  it("is this phone's pings plus only the photos I sent from the server, in time order", () => {
    const at = (h: number) => `2026-10-27T0${h}:00:00.000Z`;
    const mine = [{ at: at(1), center: [127, 37.5] as [number, number] }, { at: at(5), center: [127, 37.6] as [number, number] }];
    const server = [{ at: at(1), center: [127, 37.5] as [number, number] }, { at: at(3), center: [127, 37.7] as [number, number], photo: 'p.jpg' }];
    expect(withSentPhotos(mine, server).map((p) => p.at)).toEqual([at(1), at(3), at(5)]);
    expect(withSentPhotos(mine, [server[0]])).toBe(mine);
  });
});

describe('myGroupPings', () => {
  it("is that day's pings from this phone, oldest first, without 제외 주소 ones", () => {
    const at = (h: number) => `2026-10-19T0${h}:00:00.000Z`;
    const stored = [
      { id: 'b', day: '2026-10-19', at: at(3), name: 'B', center: [127, 37.5] as [number, number] },
      { id: 'a', day: '2026-10-19', at: at(1), name: 'A', center: [127, 37.6] as [number, number] },
      { id: 'h', day: '2026-10-19', at: at(2), name: '집 근처', center: [127, 37.7] as [number, number], local: true },
      { id: 'y', day: '2026-10-18', at: at(4), name: 'Y', center: [127, 37.8] as [number, number] },
    ];
    expect(myGroupPings(stored, '2026-10-19')).toEqual([
      { at: at(1), center: [127, 37.6], name: 'A' },
      { at: at(3), center: [127, 37.5], name: 'B' },
    ]);
  });
});

describe('newMemberPings', () => {
  it('counts only the pings since I last had that member picked', () => {
    const ann = member('ann', 0, [[126.9, 37.5], [127.0, 37.6], [127.1, 37.6]]);
    expect(newMemberPings(ann, undefined)).toBe(3);
    const seen = ann.pings.slice(0, 2).map((p) => groupPingKey(ann, p));
    expect(newMemberPings(ann, seen)).toBe(1);
    expect(newMemberPings(ann, [...seen, groupPingKey(ann, ann.pings[2])])).toBe(0);
  });
});

describe('photoPings', () => {
  const withPhotos = (n: number, photos: number[]) => {
    const m = member('ann', 0, Array.from({ length: n }, (_, k) => [126.9 + k * 0.01, 37.5] as [number, number]));
    m.pings = m.pings.map((p, i) => (photos.includes(i) ? { ...p, at: `2026-10-24T${String(i).padStart(2, '0')}:00:00.000Z`, photo: `p${i}.jpg` } : { ...p, at: `2026-10-24T${String(i).padStart(2, '0')}:00:00.000Z` }));
    return m;
  };

  it('limits a member to three, and to n − 2 places from three places up', () => {
    expect(photoLimit(1, 1)).toBe(1);
    expect(photoLimit(2, 2)).toBe(2);
    expect(photoLimit(3, 3)).toBe(1);
    expect(photoLimit(4, 4)).toBe(2);
    expect(photoLimit(5, 5)).toBe(3);
    expect(photoLimit(9, 9)).toBe(3);
    expect(photoLimit(9, 1)).toBe(1);
  });

  it('always shows the latest place with a photo, the rest stable picks among the others', () => {
    const m = withPhotos(8, [0, 1, 2, 4, 6]);
    const shown = photoPings(m, null);
    expect(shown.size).toBe(3);
    expect(shown.has(6)).toBe(true);
    expect([...shown].every((i) => [0, 1, 2, 4, 6].includes(i))).toBe(true);
    // The same day draws the same picks.
    expect([...photoPings(m, null)]).toEqual([...shown]);
  });

  it('a short day shows its photos unheld', () => {
    expect([...photoPings(withPhotos(2, [0, 1]), null)].sort()).toEqual([0, 1]);
  });

  it('none for someone else while a member is picked, nor while a photo is open', () => {
    const m = withPhotos(5, [0, 3]);
    expect(photoPings(m, 'ann').size).toBe(2);
    expect(photoPings(m, 'bo').size).toBe(0);
    expect(photoPings(m, 'ann', true).size).toBe(0);
  });
});

describe('passRoute', () => {
  it('keeps a short day whole and cuts a long one to its first and last places', () => {
    expect(passRoute(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(passRoute(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toEqual(['a', null, 'e', 'f', 'g']);
  });
});

describe('viewerStep', () => {
  it('pages the big photo and stops at both ends', () => {
    expect(viewerStep(0, 1, 3)).toBe(1);
    expect(viewerStep(2, 1, 3)).toBeNull();
    expect(viewerStep(0, -1, 3)).toBeNull();
    expect(viewerStep(2, -1, 3)).toBe(1);
  });
});
