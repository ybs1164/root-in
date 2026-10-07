import { describe, expect, it } from 'vitest';
import { diffRows, hashAll, mergeRows, rowHash, stableStringify, type Rows, type SyncRow } from './syncMerge';

const rows = (...list: SyncRow[]): Rows => new Map(list.map((r) => [String(r.id), r]));

describe('syncMerge', () => {
  it('reads the same content the same whatever the key order', () => {
    expect(stableStringify({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } })).toBe('{"a":{"d":[1,{"x":1,"y":2}]},"b":1}');
    expect(rowHash({ id: 'a', n: 1 })).toBe(rowHash({ n: 1, id: 'a' }));
    expect(rowHash({ id: 'a', n: 1 })).not.toBe(rowHash({ id: 'a', n: 2 }));
  });

  const a = { id: 'a', v: 1 };
  const a2 = { id: 'a', v: 2 };
  const a3 = { id: 'a', v: 3 };

  it('takes the side that changed', () => {
    const base = hashAll(rows(a));
    expect(mergeRows(rows(a2), rows(a), base)).toMatchObject({ upsert: [a2], localChanged: false });
    const pulled = mergeRows(rows(a), rows(a2), base);
    expect(pulled.rows.get('a')).toEqual(a2);
    expect(pulled).toMatchObject({ upsert: [], localChanged: true });
  });

  it('lets the later edit win when both changed, the server when undated', () => {
    const base = hashAll(rows(a));
    const mine = { ...a2, updated_at: '2026-10-08T10:00:00.000Z' };
    const theirs = { ...a3, updated_at: '2026-10-08T09:00:00.000Z' };
    expect(mergeRows(rows(mine), rows(theirs), base).rows.get('a')).toEqual(mine);
    expect(mergeRows(rows(a2), rows(a3), base).rows.get('a')).toEqual(a3);
  });

  it('carries deletions both ways', () => {
    const base = hashAll(rows(a));
    expect(mergeRows(rows(), rows(a), base)).toMatchObject({ remove: ['a'], localChanged: false });
    const gone = mergeRows(rows(a), rows(), base);
    expect(gone.rows.size).toBe(0);
    expect(gone.localChanged).toBe(true);
  });

  it('keeps an edit over a delete from the other side', () => {
    const base = hashAll(rows(a));
    expect(mergeRows(rows(a2), rows(), base)).toMatchObject({ upsert: [a2] });
    expect(mergeRows(rows(), rows(a2), base).rows.get('a')).toEqual(a2);
  });

  it('adds new rows from either side when nothing was agreed yet', () => {
    const b = { id: 'b' };
    const merged = mergeRows(rows(a), rows(b), {});
    expect([...merged.rows.keys()].sort()).toEqual(['a', 'b']);
    expect(merged.upsert).toEqual([a]);
  });

  it('finds what changed here since the base', () => {
    const base = hashAll(rows(a, { id: 'b' }));
    expect(diffRows(rows(a2, { id: 'c' }), base)).toEqual({ upsert: [a2, { id: 'c' }], remove: ['b'] });
  });
});
