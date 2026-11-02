import { ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { galleryDayLabel, type FeedItem } from '../domain/gallery';
import { dateKey } from '../domain/diary';
import type { Group } from '../domain/groups';
import { groupService } from '../services/groupService';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { GroupCover } from './WeNowPage';

/** What a thread's last line says, one line. */
function lastLine(item: FeedItem | undefined): string {
  if (!item) return '아직 대화가 없어요.';
  if (item.kind === 'photo') return `${item.place || '이름 없는 곳'} 사진`;
  return item.body ?? '';
}

/** Its time: HH:MM today, else the day (`10.29`). */
function lastAt(at: string, today: string): string {
  const d = new Date(at);
  const day = dateKey(d);
  if (day !== today) return galleryDayLabel(day, today);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Every group's 대화 in one list (We Now's 💬, under the gallery): a row per
 * group in my order — its cover, name, how many, and the thread's last line
 * and when — and a tap opens that group's 대화 over it. ‹, Esc, the back
 * button or a left-to-right swipe goes back to the groups.
 */
export default function ChatList({
  groups,
  unread,
  covered,
  onOpen,
  onClose,
}: {
  groups: Group[];
  /** Per group, lines of its 대화 I haven't read (a badge on its row). */
  unread: Record<string, number>;
  /** A group's 대화 is open over it (no Esc or swipe here then). */
  covered: boolean;
  onOpen(id: string): void;
  onClose(): void;
}) {
  // Each thread's last line, read once the list opens and again on coming back from one.
  const [last, setLast] = useState<Record<string, FeedItem | null>>({});
  const ids = groups.map((g) => g.id).join();
  useEffect(() => {
    if (covered) return;
    let gone = false;
    for (const g of groups) {
      void groupService.feed(g.id).then((feed) => {
        if (gone || feed === 'error') return;
        setLast((now) => ({ ...now, [g.id]: feed[feed.length - 1] ?? null }));
      });
    }
    return () => void (gone = true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, covered]);

  useEffect(() => {
    if (covered) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [covered, onClose]);
  const swipeBack = useSwipeBack(onClose, !covered);

  const today = dateKey();
  // Newest talk first; threads with none after, in my order.
  const rows = [...groups].sort((a, b) => (last[b.id]?.at ?? '').localeCompare(last[a.id]?.at ?? ''));
  return (
    <div className="group-chat chat-list" role="dialog" aria-modal="true" aria-label="대화 목록" {...swipeBack}>
      <header className="group-chat__head">
        <button className="gallery__back" aria-label="닫기" onClick={onClose}>
          <ChevronLeft size={24} strokeWidth={2.2} />
        </button>
        <h2 className="group-chat__title">TALK</h2>
        <p className="group-chat__group">모든 그룹</p>
      </header>
      <ul className="chat-list__rows">
        {rows.length === 0 && <li className="gallery__note">아직 그룹이 없어요.</li>}
        {rows.map((g) => {
          const item = last[g.id];
          return (
            <li key={g.id}>
              <button className="chat-list__row" onClick={() => onOpen(g.id)}>
                <svg className="chat-list__cover" viewBox="0 0 100 100" aria-hidden>
                  <GroupCover cover={g.cover} photo={g.coverPhoto} />
                </svg>
                <span className="chat-list__text">
                  <span className="chat-list__name">
                    {g.name}
                    <small>{g.members.length}</small>
                  </span>
                  <span className="chat-list__last">{item === undefined ? '' : lastLine(item ?? undefined)}</span>
                </span>
                <span className="chat-list__side">
                  {item && (
                    <time className="chat-list__at" dateTime={item.at}>
                      {lastAt(item.at, today)}
                    </time>
                  )}
                  {(unread[g.id] ?? 0) > 0 && (
                    <span className="chat-list__unread" aria-label={`안 읽은 메시지 ${unread[g.id]}`}>
                      {unread[g.id] > 99 ? '99+' : unread[g.id]}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
