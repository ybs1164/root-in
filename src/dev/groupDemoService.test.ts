import { describe, expect, it, vi } from 'vitest';
import type { Group } from '../domain/groups';
import type { GroupService } from '../services/groupService';
import { createGroupDemoService, demoWalked, withGroupDemoMembers } from './groupDemoService';
import { dateKey } from '../domain/diary';

const groups: Group[] = [
  { id: 'other', name: '친구들', cover: 0, inviteSlug: 'friends0', mine: true, members: [] },
  { id: 'mine', name: '마이그룹', cover: 0, inviteSlug: 'mygroup0', mine: true, members: [
    { userId: 'me', slot: 2, color: 2, nickname: '나', alias: null, photo: null, pings: [{ at: '2026-10-17T00:00:00Z', center: [127, 37.5] }] },
  ] },
];

describe('local group demo members', () => {
  it('adds two distinct members and today’s pings only to My Group without changing real members', () => {
    const result = withGroupDemoMembers(groups, '2026-10-18');
    expect(result[0]).toBe(groups[0]);
    expect(result[1].members).toHaveLength(3);
    expect(result[1].members[0]).toBe(groups[1].members[0]);
    expect(new Set(result[1].members.map((m) => m.slot)).size).toBe(3);
    expect(result[1].members.slice(1).map((m) => m.nickname)).toEqual(['더미 유저 1', '더미 유저 2']);
    expect(result[1].members[1].pings[0]).toMatchObject({ at: '2026-10-18T00:30:00.000Z', center: [127.002, 37.501], name: '광화문' });
    // Stand-in photos on all but each member's last place; the first one's
    // first place twice in a row (its photos stack once merged).
    expect(result[1].members[1].pings.map((p) => !!p.photo)).toEqual([true, true, true, false]);
    expect(result[1].members[1].pings[1]).toMatchObject({ at: '2026-10-18T00:50:00.000Z', center: [127.002, 37.501], name: '광화문' });
    expect(withGroupDemoMembers(result, '2026-10-19')[1].members).toHaveLength(3);
    // Ten days back at most, and not every one of those.
    expect(withGroupDemoMembers(groups, '2026-10-01', '2026-10-18')[1].members).toHaveLength(1);
    expect(demoWalked(0, '2026-10-18', '2026-10-18') && demoWalked(1, '2026-10-18', '2026-10-18')).toBe(true);
    expect(['2026-10-15', '2026-10-16', '2026-10-17'].filter((d) => demoWalked(1, d, '2026-10-18')).length).toBeLessThan(3);
    // Another day, another walk: a group's map paged to it shows a change.
    expect(withGroupDemoMembers(groups, '2026-10-19')[1].members[1].pings[0].center).not.toEqual([127.002, 37.501]);
    expect(groups[1].members).toHaveLength(1);
  });

  it('keeps errors and removes a dummy locally across refreshes without a server kick', async () => {
    const list = vi.fn().mockResolvedValue(groups);
    const kick = vi.fn().mockResolvedValue(true);
    const service = createGroupDemoService({ available: true, list, kick } as unknown as GroupService);
    expect(await service.kick('mine', 'dev-group-user-1')).toBe(true);
    const result = await service.list(dateKey());
    expect(result !== 'error' && result[1].members.map((m) => m.userId)).toEqual(['me', 'dev-group-user-2']);
    expect(kick).not.toHaveBeenCalled();
    await service.kick('mine', 'real-user');
    expect(kick).toHaveBeenCalledWith('mine', 'real-user');
    list.mockResolvedValue('error');
    expect(await service.list('2026-10-17')).toBe('error');
  });
});
