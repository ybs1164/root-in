import { describe, expect, it } from 'vitest';
import { stepMember, cleanGroupName, focusPoints, groupPingCount, memberColor, memberInitial, neighborGroup, tilePaths, type Group } from './groups';

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

  it('steps through the members with ALL at both ends, going round', () => {
    const g = group('g');
    expect(stepMember(g, null, 1)).toBe('a');
    expect(stepMember(g, 'a', 1)).toBe('b');
    expect(stepMember(g, 'b', 1)).toBeNull();
    expect(stepMember(g, null, -1)).toBe('b');
    expect(stepMember(g, 'gone', 1)).toBe('a');
  });
});

