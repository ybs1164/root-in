import { beforeEach, describe, expect, it } from 'vitest';
import { hideLine, loadHiddenLines, MAX_HIDDEN_LINES } from './chatHideRepository';

describe('chatHideRepository (나에게만 삭제)', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps each hidden line once, oldest dropped past the limit', () => {
    hideLine('a');
    hideLine('b');
    expect(hideLine('a')).toEqual(['a', 'b']);
    for (let i = 0; i < MAX_HIDDEN_LINES; i += 1) hideLine(`x${i}`);
    const kept = loadHiddenLines();
    expect(kept).toHaveLength(MAX_HIDDEN_LINES);
    expect(kept).not.toContain('a');
  });

  it('reads only ids', () => {
    window.localStorage.setItem('goodroot:chat-hidden:v1', JSON.stringify(['ok', 3, '', null]));
    expect(loadHiddenLines()).toEqual(['ok']);
  });
});
