import { beforeEach, describe, expect, it } from 'vitest';
import { loadGroupSeen, loadMemberSeen, memberSeenKey, saveGroupSeen, saveMemberSeen } from './groupSeenRepository';

describe('groupSeenRepository', () => {
  beforeEach(() => localStorage.clear());

  it('keeps what was seen per group', () => {
    saveGroupSeen({ g1: ['u1|2026-10-19T01:00:00.000Z'] });
    expect(loadGroupSeen()).toEqual({ g1: ['u1|2026-10-19T01:00:00.000Z'] });
  });

  it('drops broken storage and rows that make no sense', () => {
    localStorage.setItem('goodroot:group-seen:v1', '{oops');
    expect(loadGroupSeen()).toEqual({});
    localStorage.setItem('goodroot:group-seen:v1', JSON.stringify({ g1: 'x', g2: ['a', 3] }));
    expect(loadGroupSeen()).toEqual({ g2: ['a'] });
  });

  it('keeps what was seen per member, apart from the groups', () => {
    saveMemberSeen({ [memberSeenKey('g1', 'u1')]: ['u1|2026-10-24T01:00:00.000Z'] });
    expect(loadMemberSeen()).toEqual({ 'g1|u1': ['u1|2026-10-24T01:00:00.000Z'] });
    expect(loadGroupSeen()).toEqual({});
  });
});
