import { describe, expect, it } from 'vitest';
import { copyableText } from './GroupChat';

describe('copyableText', () => {
  it('copies a message or comment as written', () => {
    expect(copyableText({ kind: 'message', body: '어디가?\n같이 가요' })).toBe('어디가?\n같이 가요');
    expect(copyableText({ kind: 'comment', body: '여행!' })).toBe('여행!');
  });

  it('has nothing to copy for a photo, a deleted line or blank words', () => {
    expect(copyableText({ kind: 'photo', body: undefined })).toBeNull();
    expect(copyableText({ kind: 'message', body: '안녕', deleted: true })).toBeNull();
    expect(copyableText({ kind: 'message', body: '   ' })).toBeNull();
  });
});
