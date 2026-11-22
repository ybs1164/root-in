import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Group } from '../domain/groups';
import { clearGroupsCache, loadGroupsCache, saveGroupsCache } from './groupsCache';

const group = (pings: number): Group => ({
  id: 'g1',
  name: '우리',
  cover: 0,
  inviteSlug: 'abc',
  mine: true,
  members: [{ userId: 'u1', slot: 0, color: 0, nickname: '나', alias: null, photo: null, pings: Array.from({ length: pings }, (_, i) => ({ at: `2026-11-22T0${i}:00:00Z`, lat: 37.5, lng: 127 })) as never }],
});

describe('groupsCache', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it('opens on the groups last read, for that account', () => {
    expect(loadGroupsCache()).toBeNull();
    saveGroupsCache('u1', [group(2)]);
    const copy = loadGroupsCache();
    expect(copy?.userId).toBe('u1');
    expect(copy?.groups[0].members[0].pings).toHaveLength(2);
    clearGroupsCache();
    expect(loadGroupsCache()).toBeNull();
  });

  it("a copy from another day keeps the groups but not that day's pings", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 21, 12));
    saveGroupsCache('u1', [group(2)]);
    vi.setSystemTime(new Date(2026, 10, 22, 9));
    const copy = loadGroupsCache();
    expect(copy?.groups[0].name).toBe('우리');
    expect(copy?.groups[0].members[0].pings).toEqual([]);
  });

  it('ignores a copy that does not look right', () => {
    window.localStorage.setItem('goodroot:groups-cache:v1', JSON.stringify({ userId: 'u1', day: '2026-11-22', groups: [{ id: 3 }, null] }));
    expect(loadGroupsCache()?.groups).toEqual([]);
    window.localStorage.setItem('goodroot:groups-cache:v1', '{broken');
    expect(loadGroupsCache()).toBeNull();
  });
});
