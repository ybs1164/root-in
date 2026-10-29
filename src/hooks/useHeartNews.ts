import { useEffect, useRef } from 'react';
import type { AuthUser } from '../services/authService';
import { groupService, type GroupService, type HeartNews } from '../services/groupService';

/** How often a visible app looks for new hearts. */
const HEART_POLL_MS = 60_000;

/** The notice for new hearts on my photos: one, or the newest and how many more people. */
export function heartNotice(news: readonly HeartNews[]): string | null {
  if (!news.length) return null;
  const people = [...new Set(news.map((n) => n.fromUser))];
  const [first] = news;
  if (people.length > 1) return `${first.nickname}님 외 ${people.length - 1}명이 내 사진에 하트를 눌렀어요.`;
  if (news.length === 1 && first.place) return `${first.nickname}님이 '${first.place}' 사진에 하트를 눌렀어요.`;
  return `${first.nickname}님이 내 사진에 하트를 눌렀어요.`;
}

/**
 * The gallery's hearts, from the sender's side: while signed in, looks for
 * hearts on my photos when the app starts, comes back to the front and every
 * minute it's in view, says so (`onNotice`) and marks them shown. There are
 * no push notifications yet: a heart waits for the app to look.
 */
export function useHeartNews(user: AuthUser | null, onNotice: (text: string) => void, service: GroupService = groupService): void {
  const notice = useRef(onNotice);
  notice.current = onNotice;
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId || !service.available) return;
    let busy = false;
    const look = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      const news = await service.heartNews();
      busy = false;
      const text = heartNotice(news);
      if (!text) return;
      notice.current(text);
      void service.heartsSeen(news[0].at);
    };
    void look();
    const timer = window.setInterval(() => void look(), HEART_POLL_MS);
    const onShow = () => document.visibilityState === 'visible' && void look();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [userId, service]);
}
