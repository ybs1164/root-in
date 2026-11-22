import { afterEach, describe, expect, it } from 'vitest';
import { amend, forgetReads, readOnce, recall, remember } from './readCache';

afterEach(() => forgetReads());

describe('readCache', () => {
  it('keeps the last answer for a key and changes it in place', () => {
    expect(recall('a')).toBeUndefined();
    remember('a', [1]);
    amend<number[]>('a', (v) => [...v, 2]);
    expect(recall('a')).toEqual([1, 2]);
  });

  it('asks once while a read is out, and keeps only answers that came', async () => {
    let calls = 0;
    const read = () => new Promise<string[] | 'error'>((done) => setTimeout(() => done((calls += 1) === 1 ? ['x'] : 'error'), 1));
    const [one, two] = await Promise.all([readOnce('k', read), readOnce('k', read)]);
    expect(calls).toBe(1);
    expect(one).toEqual(['x']);
    expect(two).toEqual(['x']);
    expect(await readOnce('k', read)).toBe('error');
    expect(recall('k')).toEqual(['x']);
  });

  it('drops a read that set out before the account changed', async () => {
    const going = readOnce('k', async () => ['old']);
    forgetReads();
    await going;
    expect(recall('k')).toBeUndefined();
  });
});
