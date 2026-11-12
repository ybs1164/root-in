import { beforeEach, describe, expect, it } from 'vitest';
import { loadMyGroupLooks, saveMyGroupLooks } from './groupLookRepository';

describe('my group looks on this phone', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps each group its own, across a reload', () => {
    let all = loadMyGroupLooks();
    all = saveMyGroupLooks(all, 'g1', { pings: { '2026-11-12T01:00:00.000Z': 'star' }, edges: {} });
    all = saveMyGroupLooks(all, 'g2', { pings: {}, edges: { '2026-11-12T01:00:00.000Z>2026-11-12T02:00:00.000Z': 'dashed' } });
    expect(loadMyGroupLooks()).toEqual(all);
    expect(loadMyGroupLooks().g1.pings).toEqual({ '2026-11-12T01:00:00.000Z': 'star' });
  });

  it('drops what it cannot read', () => {
    window.localStorage.setItem('goodroot:group-looks:v1', JSON.stringify({ g1: { pings: { bad: 'star', '2026-11-12T01:00:00.000Z': 'cube', '2026-11-12T02:00:00.000Z': 'heart' }, edges: [] }, g2: 5 }));
    expect(loadMyGroupLooks()).toEqual({ g1: { pings: { '2026-11-12T02:00:00.000Z': 'heart' }, edges: {} } });
    window.localStorage.setItem('goodroot:group-looks:v1', '{');
    expect(loadMyGroupLooks()).toEqual({});
  });
});
