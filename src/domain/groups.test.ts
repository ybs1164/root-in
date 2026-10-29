import { describe, expect, it } from 'vitest';
import { firstFreeColor, takenColors, MEMBER_COLORS, MEMBER_COLOR_NAMES, stepMember, cleanGroupName, focusPoints, groupPingCount, memberColor, memberInitial, neighborGroup, tilePaths, newPingCount, newMemberPings, photoPings, passRoute, viewerStep, groupPingKey, groupPingKeys, myGroupPings, sharedPlacePings, withSentPhotos, mergeSamePlace, pingPhotos, metPairs, photoKey, placeTime, isGroupBirthday, readPingDays, withMyPingDays, dayPingers, type Group } from './groups';

const member = (userId: string, slot: number, pings: [number, number][]) => ({
  userId,
  slot,
  color: slot,
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
  it('has a colour of its own for each of a group\'s 20 places', () => {
    expect(MEMBER_COLORS).toHaveLength(20);
    expect(MEMBER_COLOR_NAMES).toHaveLength(20);
    expect(new Set(MEMBER_COLOR_NAMES).size).toBe(20);
    expect(memberColor(0)).toBe('var(--member-0)');
    expect(memberColor(19)).toBe('var(--member-19)');
  });

  it('gives a joiner the first colour nobody has, and none when all are taken', () => {
    expect(firstFreeColor([])).toBe(0);
    expect(firstFreeColor([{ color: 0 }, { color: 1 }, { color: 3 }])).toBe(2);
    expect(firstFreeColor(MEMBER_COLORS.map((color) => ({ color })))).toBeNull();
  });

  it("blocks the other members' colours, not mine", () => {
    const g = group('g', [{ ...member('a', 0, []), color: 4 }, { ...member('b', 1, []), color: 9 }]);
    expect([...takenColors(g, 'a')]).toEqual([9]);
    expect([...takenColors(g, null)].sort()).toEqual([4, 9]);
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
    members: Object.entries(pings).map(([userId, ats], slot) => ({ userId, slot, color: slot, nickname: userId, alias: null, photo: null, pings: ats.map((at) => ({ at, center: [127, 37.5] as [number, number] })) })),
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

describe('metPairs', () => {
  it('pairs the members who were at the same place, each pair once', () => {
    const members = [member('a', 0, [[127, 37.5], [127.1, 37.6]]), member('b', 1, [[127.0002, 37.5001]]), member('c', 2, [[127.3, 37.7]])];
    expect(metPairs(members)).toEqual([['a', 'b']]);
    expect(metPairs([members[0], members[2]])).toEqual([]);
  });
});

describe('mergeSamePlace', () => {
  const at = (h: number) => `2026-10-29T0${h}:00:00.000Z`;
  const here: [number, number] = [127, 37.5];
  const near: [number, number] = [127.0002, 37.5001]; // ~20 m
  const away: [number, number] = [127.01, 37.51];

  it('makes photos sent from one place in a row one ping, the newest on top', () => {
    const merged = mergeSamePlace([
      { at: at(1), center: here, name: '카페', photo: 'a.jpg' },
      { at: at(2), center: near, name: '카페', photo: 'b.jpg' },
      { at: at(3), center: here, name: '카페', photo: 'c.jpg' },
    ]);
    expect(merged).toEqual([{ at: at(3), center: here, name: '카페', photo: 'c.jpg', photos: ['a.jpg', 'b.jpg', 'c.jpg'], photoAts: [at(1), at(2), at(3)] }]);
    expect(pingPhotos(merged[0])).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    // Each photo keeps its own time: the tapped one's, else the newest's.
    const clock = (iso: string) => `${String(new Date(iso).getHours()).padStart(2, '0')}:00`;
    expect(placeTime(merged[0], 0)).toBe(clock(at(1)));
    expect(placeTime(merged[0])).toBe(clock(at(3)));
  });

  it('takes a TODAY ping and the photos after it at that place together', () => {
    expect(mergeSamePlace([{ at: at(1), center: here, name: '카페' }, { at: at(2), center: here, name: '카페', photo: 'a.jpg' }])).toEqual([
      { at: at(2), center: here, name: '카페', photo: 'a.jpg', photoAts: [at(2)] },
    ]);
    // A photo, then the TODAY ping it put there later: the photo's time, not the ping's.
    const [later] = mergeSamePlace([{ at: at(1), center: here, name: '카페', photo: 'a.jpg' }, { at: at(2), center: here, name: '카페' }]);
    expect(placeTime(later)).toBe(placeTime({ at: at(1), center: here }));
  });

  it('keeps another place, a differently named one next door, and coming back as their own pings', () => {
    const pings = [
      { at: at(1), center: here, name: '카페', photo: 'a.jpg' },
      { at: at(2), center: near, name: '서점', photo: 'b.jpg' },
      { at: at(3), center: away, name: '공원' },
      { at: at(4), center: here, name: '카페', photo: 'c.jpg' },
    ];
    expect(mergeSamePlace(pings).map((p) => p.at)).toEqual([at(1), at(2), at(3), at(4)]);
    expect(pingPhotos({ at: at(1), center: here })).toEqual([]);
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
    m.pings = m.pings.map((p, i) => (photos.includes(i) ? { ...p, photo: `p${i}.jpg` } : p));
    return m;
  };

  it('shows every ping that has a photo, however many', () => {
    expect([...photoPings(withPhotos(8, [0, 1, 2, 4, 6]))]).toEqual([0, 1, 2, 4, 6]);
    expect([...photoPings(withPhotos(3, [0, 1, 2]))]).toEqual([0, 1, 2]);
    expect(photoPings(withPhotos(3, [])).size).toBe(0);
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

describe('sharedPlacePings', () => {
  it('marks pings where another member was within 50m, both sides, by distance not id', () => {
    const a = member('a', 0, [[127.0, 37.5], [127.1, 37.6]]);
    // ~20m east of a's first ping; the second is far from everything.
    const b = member('b', 1, [[127.0002, 37.5], [127.3, 37.7]]);
    const shared = sharedPlacePings([a, b]);
    expect([...shared].sort()).toEqual([groupPingKey(a, a.pings[0]), groupPingKey(b, b.pings[0])].sort());
  });

  it("doesn't count one member's own pings at the same place", () => {
    const a = member('a', 0, [[127.0, 37.5], [127.0001, 37.5]]);
    expect(sharedPlacePings([a, member('b', 1, [[128, 36]])]).size).toBe(0);
  });
});

describe('group calendar days', () => {
  it('reads the server pairs, skipping bad rows and repeats', () => {
    expect(
      readPingDays([
        { day: '2026-10-27', user_id: 'a' },
        { day: '2026-10-27', user_id: 'a' },
        { day: '2026-10-27', user_id: 'b' },
        { day: '10/28', user_id: 'a' },
        { day: '2026-10-28', user_id: 7 },
        null,
      ]),
    ).toEqual({ '2026-10-27': ['a', 'b'] });
    expect(readPingDays('nope')).toEqual({});
  });

  it('adds my own days and picks faces in the group order', () => {
    const days = withMyPingDays({ '2026-10-27': ['b'] }, 'me', ['2026-10-27', '2026-10-28']);
    expect(days).toEqual({ '2026-10-27': ['b', 'me'], '2026-10-28': ['me'] });
    const face = (userId: string, slot: number) => ({ userId, slot, color: slot, nickname: userId, alias: null, photo: null, pings: [] });
    const group = { id: 'g', name: 'g', cover: 0, inviteSlug: 'abcdefgh', mine: true, members: [face('me', 0), face('b', 1), face('c', 2)] };
    expect(dayPingers(group, days['2026-10-27']).map((m) => m.userId)).toEqual(['me', 'b']);
    expect(dayPingers(group, undefined)).toEqual([]);
  });
});

describe('photoKey', () => {
  it('reads the bucket path off a sent photo\'s address, as the gallery keys stars and hearts', () => {
    const path = '0f8a2c1e-1111-4222-8333-944455556666/abcdef1234.jpg';
    expect(photoKey(`https://x.supabase.co/storage/v1/object/public/group-photos/${path}`)).toBe(path);
    expect(photoKey(`https://x.supabase.co/storage/v1/object/public/group-photos/${path}?v=1`)).toBe(path);
    expect(photoKey('https://elsewhere.example/a.jpg')).toBeNull();
    expect(photoKey(undefined)).toBeNull();
    const demo = photoKey('data:image/png;base64,AAAA');
    expect(demo).toMatch(/^demo\/u[0-9a-z]+$/);
    expect(photoKey('data:image/png;base64,AAAA')).toBe(demo);
  });
});

describe('isGroupBirthday', () => {
  it('is the day the group was made and the same date every year after', () => {
    const made = new Date(2026, 9, 28, 15).toISOString();
    expect(isGroupBirthday('2026-10-28', made)).toBe(true);
    expect(isGroupBirthday('2027-10-28', made)).toBe(true);
    expect(isGroupBirthday('2025-10-28', made)).toBe(false);
    expect(isGroupBirthday('2026-10-29', made)).toBe(false);
    expect(isGroupBirthday('2026-10-28', undefined)).toBe(false);
  });
});
