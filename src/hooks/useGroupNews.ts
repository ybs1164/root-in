import { useEffect, useRef } from 'react';
import { onPushTap, registerPush } from '../lib/push';
import type { AuthUser } from '../services/authService';
import { groupService, type GroupNews, type GroupService } from '../services/groupService';
import { pushTokenService, type PushTokenService } from '../services/pushService';

/** How often a visible app looks for news when its channel is quiet (a dropped socket). */
const NEWS_POLL_MS = 60_000;
/** Notes that come together (a member's photo to two groups) are read once. */
const NEWS_GATHER_MS = 250;

/**
 * The notice for 그룹 알림 · 새로운 루트: one place, a member's several, or
 * the newest member and how many more. The pushes say the same
 * (supabase/functions/push-news/payload.ts).
 */
export function newsNotice(news: readonly GroupNews[]): string | null {
  if (!news.length) return null;
  const [first] = news;
  const people = new Set(news.map((n) => n.fromUser)).size;
  if (people > 1) return `${first.name}님 외 ${people - 1}명이 새 장소에 핑을 찍었어요.`;
  if (news.length > 1) return `${first.name}님이 새 장소 ${news.length}곳에 핑을 찍었어요.`;
  return `${first.name}님이 '${first.place}'에 핑을 찍었어요.`;
}

export interface GroupNewsHandlers {
  /** Says the news in the app (its notice pill). */
  onNotice(text: string): void;
  /** A push was tapped: open that group. */
  onOpenGroup(groupId: string): void;
}

/**
 * 그룹 알림 · 새로운 루트, from the receiving side. While signed in (a guest
 * too): the app looks for news when it starts, comes to the front, the server
 * says there's some (the private channel user:<id>) and every minute it's in
 * view; says it and marks it shown. On the phone apps it also registers for
 * pushes (they come while the app is closed, from the push-news function), and
 * a tapped push opens its group.
 */
export function useGroupNews(
  user: AuthUser | null,
  handlers: GroupNewsHandlers,
  service: GroupService = groupService,
  tokens: PushTokenService = pushTokenService,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId || !service.available) return;
    let busy = false;
    let again = false;
    let gather: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const look = async () => {
      if (stopped || document.visibilityState === 'hidden') return;
      if (busy) return void (again = true);
      busy = true;
      const news = await service.news();
      busy = false;
      const text = !stopped && newsNotice(news);
      if (text) {
        handlersRef.current.onNotice(text);
        void service.newsSeen(news[0].at);
      }
      if (again) {
        again = false;
        void look();
      }
    };
    const soon = () => {
      if (gather) clearTimeout(gather);
      gather = setTimeout(() => void look(), NEWS_GATHER_MS);
    };
    void look();
    const stopLive = service.watch({ user: userId }, (event) => {
      if (event.kind === 'news' || event.kind === 'resync') soon();
    });
    const timer = window.setInterval(() => void look(), NEWS_POLL_MS);
    const onShow = () => document.visibilityState === 'visible' && void look();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      stopped = true;
      if (gather) clearTimeout(gather);
      stopLive();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [userId, service]);

  // Pushes: this phone's token on the account while someone is signed in.
  useEffect(() => {
    if (!userId || !tokens.available) return;
    return registerPush((token, platform) => void tokens.save(token, platform));
  }, [userId, tokens]);

  // A tapped push opens its group; what it said was seen on the phone already.
  useEffect(
    () =>
      onPushTap((groupId) => {
        if (groupId) handlersRef.current.onOpenGroup(groupId);
        void service.newsSeen(new Date().toISOString());
      }),
    [service],
  );
}
