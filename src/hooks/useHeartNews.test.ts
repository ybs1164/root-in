import { describe, expect, it } from 'vitest';
import { heartNotice } from './useHeartNews';

const news = (fromUser: string, nickname: string, place: string | null = null) => ({ path: 'x', fromUser, nickname, place, at: '2026-11-02T01:00:00Z' });

describe('heartNotice', () => {
  it('says who hearted (and the place, for one photo), never how many hearts', () => {
    expect(heartNotice([])).toBeNull();
    expect(heartNotice([news('a', '민수', '서촌 카페')])).toBe("민수님이 '서촌 카페' 사진에 하트를 눌렀어요.");
    expect(heartNotice([news('a', '민수'), news('a', '민수', '광화문')])).toBe('민수님이 내 사진에 하트를 눌렀어요.');
    expect(heartNotice([news('a', '민수'), news('b', '지은'), news('c', '도윤')])).toBe('민수님 외 2명이 내 사진에 하트를 눌렀어요.');
  });
});
