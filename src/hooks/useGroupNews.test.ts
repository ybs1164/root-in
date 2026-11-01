import { describe, expect, it } from 'vitest';
import { newsMessage } from '../../supabase/functions/push-news/payload';
import { newsNotice } from './useGroupNews';

const at = '2026-11-08T01:00:00Z';
const news = (fromUser: string, name: string, place: string) => ({ id: `${fromUser}-${place}`, fromUser, groupId: 'g', name, groupName: '우리', place, at });

describe('newsNotice', () => {
  it('names the place for one, counts places for one member, and people for several', () => {
    expect(newsNotice([])).toBeNull();
    expect(newsNotice([news('a', '민수', '서촌 카페')])).toBe("민수님이 '서촌 카페'에 핑을 찍었어요.");
    expect(newsNotice([news('a', '민수', '광화문'), news('a', '민수', '서촌 카페')])).toBe('민수님이 새 장소 2곳에 핑을 찍었어요.');
    expect(newsNotice([news('a', '민수', '광화문'), news('b', '지은', '서촌'), news('c', '도윤', '통인시장')])).toBe('민수님 외 2명이 새 장소에 핑을 찍었어요.');
  });

  it('says one place the way the push does', () => {
    const one = news('a', '민수', '서촌 카페');
    const push = newsMessage({ id: one.id, to_user: 'me', from_user: 'a', group_id: 'g', kind: 'route', name: '민수', group_name: '우리', place: '서촌 카페' });
    expect(push.body).toBe(newsNotice([one]));
    expect(push.title).toBe('우리');
  });
});
