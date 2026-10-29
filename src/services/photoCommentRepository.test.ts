import { beforeEach, describe, expect, it } from 'vitest';
import { addLocalComment, loadLocalComments } from './photoCommentRepository';

describe('photoCommentRepository', () => {
  beforeEach(() => localStorage.clear());

  it("keeps a TODAY photo's comments on this phone, oldest first", () => {
    expect(addLocalComment('ping:a', '  첫 댓글 ', new Date('2026-10-30T01:00:00Z'))).toBe(true);
    expect(addLocalComment('ping:a', '두 번째', new Date('2026-10-30T02:00:00Z'))).toBe(true);
    expect(addLocalComment('ping:a', '   ')).toBe(false);
    expect(loadLocalComments('ping:a').map((c) => c.body)).toEqual(['첫 댓글', '두 번째']);
    expect(loadLocalComments('ping:b')).toEqual([]);
  });

  it('drops broken storage and comments that make no sense', () => {
    localStorage.setItem('goodroot:photo-comments:v1', '{oops');
    expect(loadLocalComments('ping:a')).toEqual([]);
    localStorage.setItem('goodroot:photo-comments:v1', JSON.stringify({ 'ping:a': [{ id: 'c', body: 'ok', at: '2026-10-30T01:00:00Z' }, { id: 'd', body: '', at: 'x' }, 3] }));
    expect(loadLocalComments('ping:a').map((c) => c.body)).toEqual(['ok']);
  });
});
