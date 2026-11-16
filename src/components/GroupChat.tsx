import { ArrowDown, ArrowUp, Camera, ChevronLeft, ChevronRight, Reply, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { COMMENT_MAX, galleryDayLabel, unreadBy, type FeedItem, type FeedRef } from '../domain/gallery';
import { GROUP_LIMITS, isGroupBirthday, memberColor, memberInk, type Group, type GroupMember } from '../domain/groups';
import { dateKey } from '../domain/diary';
import { monthGrid, shiftMonth } from '../domain/calendar';
import { groupService } from '../services/groupService';
import { useLiveRefresh } from '../hooks/useLiveRefresh';
import { MemberFace } from './WeNowPage';
import PhotoViewer, { OpenPhotoMarks } from './PhotoViewer';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { hideLine, loadHiddenLines } from '../services/chatHideRepository';
import { showModalQuietly } from '../lib/dialog';
import { useBackdropTap } from '../hooks/useBackdropTap';
import ConfirmDialog from './ConfirmDialog';

/** The day calendar's height (its six weeks), to flip it over a pill low on the screen. */
const PICKER_HEIGHT = 330;

/** How far from the bottom (px) still counts as reading the newest: a line coming in scrolls down to it. */
const NEAR_BOTTOM_PX = 80;

/** Someone no longer in the group: no face, a neutral name. */
const goneMember = (userId: string): GroupMember => ({ userId, slot: 0, color: 0, nickname: '나간 그룹원', alias: null, photo: null, pings: [] });

const placeName = (name: string | undefined) => name || '이름 없는 곳';

/** A press held this long on a line opens its menu (답장 · 모두에게 삭제 · 나에게만 삭제). */
const HOLD_MS = 450;
/** A line slid inward this far (px) answers it on letting go; it follows the finger up to `SWIPE_MAX_PX`. */
export const SWIPE_REPLY_PX = 56;
const SWIPE_MAX_PX = 80;
/** A finger that moved this far isn't holding still: no menu (it scrolls, or slides the line). */
const MOVE_PX = 8;

/** What a line says, short: a reply's quote and the reply bar show it. */
export function lineSnippet(item: Pick<FeedItem, 'kind' | 'body' | 'place' | 'deleted'>): string {
  if (item.deleted) return '삭제된 메시지예요';
  if (item.kind === 'photo') return `${placeName(item.place)} 사진`;
  return item.body ?? '';
}

/** HH:MM, local. */
const clock = (at: string) => {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * A group's 대화, over its map (the button at the bottom-right): one
 * thread, oldest first, of everything said and sent in the group — a photo
 * someone sent (the place and the photo), a comment on one of those photos
 * (marked with the photo it's on), and messages written right here. Each
 * line is the member's face with a speech bubble beside it and its time
 * (mine on the right in the accent colour, no face), a day heading where
 * the day changes. A photo opens big
 * (♥ ★ and its comments there, as anywhere); the line at the bottom writes
 * a message to the group.
 */
export default function GroupChat({
  group,
  me,
  photoSeq,
  onPhotoSeq,
  onClose,
  onRead,
}: {
  group: Group;
  me: string | null;
  /** The thread's photo open big (among its photos, oldest first); App holds it, for the back button. */
  photoSeq: number | null;
  onPhotoSeq(seq: number | null): void;
  onClose(): void;
  /** I've read the 대화 up to now (App reads the unread counts again). */
  onRead?(): void;
}) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  // 나에게만 삭제: lines hidden on this phone.
  const [hidden, setHidden] = useState(() => new Set(loadHiddenLines()));
  const shownItems = useMemo(() => items?.filter((i) => !hidden.has(i.id)) ?? null, [items, hidden]);
  // Each member's last read of the 대화: the numbers beside the lines (who hasn't read them yet).
  const [reads, setReads] = useState<Record<string, string> | null>(null);
  const asked = useRef(0);
  const read = useCallback(async () => {
    const n = ++asked.current;
    const [feed, seen] = await Promise.all([groupService.feed(group.id), groupService.reads(group.id)]);
    // Only the latest read counts: live nudges can overlap.
    if (n !== asked.current) return;
    if (seen !== 'error') setReads(seen);
    if (feed === 'error') setFailed(true), setItems((now) => now ?? []);
    else setFailed(false), setItems(feed);
  }, [group.id]);
  // Open, I've read it up to now — and again whenever a new line comes in while it's open.
  const newestSeen = items?.length ? items[items.length - 1].id : null;
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;
  useEffect(() => {
    if (items === null) return;
    void groupService.markRead(group.id).then((ok) => ok && onReadRef.current?.());
  }, [group.id, newestSeen, items === null]);
  const memberIds = useMemo(() => group.members.map((m) => m.userId), [group.members]);
  useEffect(() => {
    void read();
  }, [read]);
  // Live: a line written in the group reads the 대화 again (not one already
  // here, like the one I just sent); a timer and the app coming back catch up.
  const shown = useRef(new Set<string>());
  useEffect(() => {
    shown.current = new Set((items ?? []).map((i) => i.id));
  }, [items]);
  useLiveRefresh({ group: group.id }, () => void read(), { known: (id) => shown.current.has(id) });
  // Back from a big photo: a comment may have been written there.
  const wasBig = useRef(false);
  useEffect(() => {
    if (wasBig.current && photoSeq === null) void read();
    wasBig.current = photoSeq !== null;
  }, [photoSeq, read]);

  const who = (item: FeedItem): GroupMember => {
    if (item.mine) return group.members.find((m) => m.userId === me) ?? goneMember(item.userId);
    return group.members.find((m) => m.userId === item.userId) ?? goneMember(item.userId);
  };
  const photos = useMemo(() => (shownItems ?? []).filter((i) => i.kind === 'photo'), [shownItems]);
  // My colour here: the doodle tools' one ink on a photo opened big.
  const myMember = group.members.find((m) => m.userId === me);
  const myColor = myMember ? `member-${myMember.color % GROUP_LIMITS.members}` : null;
  const inkOf = useCallback((userId: string) => memberInk([group], userId), [group]);
  const openPhoto = (path: string | undefined) => {
    const seq = photos.findIndex((p) => p.path === path);
    if (seq >= 0) onPhotoSeq(seq);
  };

  // Kept at the newest: on opening, and whenever a line comes in — not on a
  // re-read that brought nothing new (it'd pull away from a day jumped to),
  // and not while scrolled up reading older talk: then a '새 메시지' pill
  // (a tap goes down to it) unless the new line is mine.
  const list = useRef<HTMLOListElement>(null);
  const newest = useRef<string | null>(null);
  const [unseen, setUnseen] = useState(false);
  useEffect(() => {
    const el = list.current;
    const lastItem = items?.length ? items[items.length - 1] : null;
    const last = lastItem?.id ?? null;
    if (!el || last === newest.current) return;
    const opening = newest.current === null;
    newest.current = last;
    const away = el.scrollHeight - el.scrollTop - el.clientHeight > NEAR_BOTTOM_PX;
    if (!opening && away && !lastItem?.mine) return setUnseen(true);
    el.scrollTop = el.scrollHeight;
    setUnseen(false);
  }, [items]);
  const toNewest = () => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setUnseen(false);
  };
  const onScroll = () => {
    const el = list.current;
    if (unseen && el && el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX) setUnseen(false);
  };

  // The keyboard coming up shortens the thread (the screen sits on it): with
  // the input focused, the newest line stays in sight right over it.
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = list.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const watch = new ResizeObserver(() => {
      if (document.activeElement === input.current) el.scrollTop = el.scrollHeight;
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // A day heading tapped: a small calendar beside it, only the days with
  // talk pressable; one picked scrolls the thread so that day is at the top.
  const days = useMemo(() => new Set((items ?? []).map((i) => dateKey(new Date(i.at)))), [items]);
  const [picker, setPicker] = useState<{ day: string; top: number; left: number } | null>(null);
  const openPicker = (day: string, el: HTMLElement) => {
    const box = el.getBoundingClientRect();
    // Under the pill, or over it when there isn't room below.
    const below = box.bottom + 6;
    const top = below + PICKER_HEIGHT > window.innerHeight - 8 ? Math.max(8, box.top - 6 - PICKER_HEIGHT) : below;
    setPicker({ day, top, left: box.left + box.width / 2 });
  };
  const jumpTo = (day: string) => {
    setPicker(null);
    const box = list.current;
    const heading = box?.querySelector<HTMLElement>(`[data-day="${day}"]`);
    if (box && heading) box.scrollTo({ top: heading.offsetTop - 8, behavior: 'smooth' });
  };

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  // The line being answered (a bar over the input says which), from its menu or a slide.
  const [replyTo, setReplyTo] = useState<FeedItem | null>(null);
  const startReply = (item: FeedItem) => {
    setReplyTo(item);
    input.current?.focus();
  };
  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const ok = await groupService.sendMessage(group.id, text, replyTo ? { kind: replyTo.kind, id: replyTo.id } : undefined);
    setSending(false);
    setSendFailed(!ok);
    if (!ok) return;
    setText('');
    setReplyTo(null);
    void read();
  };

  // A line held down: its menu. 모두에게 삭제 (my own lines only) asks first.
  const [menuFor, setMenuFor] = useState<FeedItem | null>(null);
  const [deletingAll, setDeletingAll] = useState<FeedItem | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const deleteForAll = async (item: FeedItem) => {
    const ok = await groupService.deleteLine(group.id, item);
    setDeleteFailed(!ok);
    if (ok && replyTo?.id === item.id) setReplyTo(null);
    void read();
  };
  const deleteForMe = (item: FeedItem) => {
    setHidden(new Set(hideLine(item.id)));
    if (replyTo?.id === item.id) setReplyTo(null);
  };

  // A press on a line: held still, its menu; slid inward (toward the middle:
  // right for theirs, left for mine), the line follows and, past
  // SWIPE_REPLY_PX, answers it on letting go. The finger is moved on the
  // line's own style, not React state, so it keeps up.
  const press = useRef<{ item: FeedItem; line: HTMLElement; x: number; y: number; mode: 'wait' | 'held' | 'slide' | 'off'; pull: number; timer: number } | null>(null);
  const swallowClick = useRef(false);
  const settle = (line: HTMLElement) => {
    line.classList.add('is-settling');
    line.style.removeProperty('translate');
    line.style.setProperty('--pull', '0');
    window.setTimeout(() => line.classList.remove('is-settling'), 200);
  };
  const lineHandlers = (item: FeedItem) => ({
    'data-swipe-keep': '',
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button > 0) return;
      swallowClick.current = false;
      const line = e.currentTarget.closest('li');
      if (!line) return;
      const timer = window.setTimeout(() => {
        const p = press.current;
        if (!p || p.mode !== 'wait') return;
        p.mode = 'held';
        swallowClick.current = true;
        navigator.vibrate?.(10);
        setMenuFor(item);
      }, HOLD_MS);
      press.current = { item, line, x: e.clientX, y: e.clientY, mode: 'wait', pull: 0, timer };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const p = press.current;
      if (!p || p.mode === 'held' || p.mode === 'off') return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      const inward = item.mine ? -dx : dx;
      if (p.mode === 'wait') {
        if (Math.hypot(dx, dy) < MOVE_PX) return;
        window.clearTimeout(p.timer);
        if (item.deleted || inward <= 0 || Math.abs(dx) < Math.abs(dy) * 1.3) return void (p.mode = 'off');
        p.mode = 'slide';
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      // Past the reply point it gives, so it never runs off.
      const raw = Math.max(0, inward);
      p.pull = raw <= SWIPE_REPLY_PX ? raw : Math.min(SWIPE_MAX_PX, SWIPE_REPLY_PX + (raw - SWIPE_REPLY_PX) * 0.35);
      p.line.style.translate = `${item.mine ? -p.pull : p.pull}px 0`;
      p.line.style.setProperty('--pull', String(Math.min(1, p.pull / SWIPE_REPLY_PX)));
    },
    onPointerUp: () => {
      const p = press.current;
      press.current = null;
      if (!p) return;
      window.clearTimeout(p.timer);
      if (p.mode !== 'slide') return;
      swallowClick.current = true;
      settle(p.line);
      if (p.pull >= SWIPE_REPLY_PX) startReply(item);
    },
    onPointerCancel: () => {
      const p = press.current;
      press.current = null;
      if (!p) return;
      window.clearTimeout(p.timer);
      if (p.mode === 'slide') settle(p.line);
    },
    // A held or slid line doesn't also open its photo.
    onClickCapture: (e: ReactMouseEvent) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });
  // A reply's quote tapped: the line it answers comes into view, lit a moment.
  const showLine = (id: string) => {
    const el = list.current?.querySelector<HTMLElement>(`[data-line="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('is-lit');
    void el.offsetWidth;
    el.classList.add('is-lit');
  };
  const nameOf = (item: FeedItem) => (item.mine ? '나' : who(item).nickname);

  useEffect(() => {
    if (photoSeq !== null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || menuFor || deletingAll) return;
      if (picker) setPicker(null);
      else if (replyTo) setReplyTo(null);
      else onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [photoSeq, onClose, picker, replyTo, menuFor, deletingAll]);

  // Left to right, back to the group's map under it (not while a photo is big over it).
  const swipeBack = useSwipeBack(onClose, photoSeq === null && !picker && !menuFor && !deletingAll);

  const today = dateKey();
  let lastDay = '';
  return (
    <div className="group-chat" role="dialog" aria-modal="true" aria-label={`${group.name} 대화`} {...swipeBack}>
      <header className="group-chat__head">
        <button className="gallery__back" aria-label="닫기" onClick={onClose}>
          <ChevronLeft size={24} strokeWidth={2.2} />
        </button>
        <h2 className="group-chat__title">TALK</h2>
        <p className="group-chat__group">{group.name}</p>
      </header>

      <ol ref={list} className="group-chat__list" aria-label="대화 내역" onScroll={onScroll}>
        {items === null && <li className="gallery__note">대화를 불러오는 중…</li>}
        {shownItems?.length === 0 && !failed && <li className="gallery__note">아직 대화가 없어요. 사진을 보내거나 말을 걸어 보세요.</li>}
        {failed && <li className="gallery__note">대화를 불러오지 못했어요.</li>}
        {shownItems?.map((item) => {
          const member = who(item);
          const day = dateKey(new Date(item.at));
          const heading = day !== lastDay ? galleryDayLabel(day, today) : null;
          lastDay = day;
          return [
            heading && (
              <li key={`day-${day}`} className="group-chat__day" data-day={day}>
                <button aria-label={`${heading}, 날짜로 이동`} aria-haspopup="dialog" onClick={(e) => openPicker(day, e.currentTarget)}>
                  <span>{heading}</span>
                </button>
              </li>
            ),
            <li key={item.id} data-line={item.id} className={`group-chat__line ${item.mine ? 'is-mine' : ''}`} style={{ '--member': memberColor(member.color) } as CSSProperties}>
              {/* Slid inward, the reply arrow fades in behind it. */}
              <span className="group-chat__slide-reply" aria-hidden>
                <Reply size={20} strokeWidth={2.4} />
              </span>
              {/* Mine on the right, bare; everyone else's with their face and name. */}
              {!item.mine && <MemberFace member={member} size={36} />}
              <div className="group-chat__said" {...lineHandlers(item)}>
                {!item.mine && <span className="group-chat__who">{member.nickname}</span>}
                <div className="group-chat__row">
                  <div className="group-chat__bubble">
                    {item.kind === 'photo' ? (
                      <button className="group-chat__photo" aria-label={`${placeName(item.place)} 사진 크게 보기`} onClick={() => openPhoto(item.path)}>
                        <strong>{placeName(item.place)}</strong>
                        {item.photo ? <img src={item.photo} alt="" loading="lazy" draggable={false} /> : <Camera size={28} aria-hidden />}
                      </button>
                    ) : (
                      <>
                        {item.replyTo && !item.deleted && (() => {
                          const target = (items ?? []).find((i) => i.id === item.replyTo?.id);
                          const gone = !target || hidden.has(target.id);
                          return (
                            <button
                              type="button"
                              className="group-chat__reply-quote"
                              aria-label={gone ? '이전 메시지에 답장' : `${nameOf(target)}에게 답장, 원래 메시지 보기`}
                              onClick={() => !gone && showLine(target.id)}
                            >
                              <b>{gone ? '이전 메시지' : `${nameOf(target)}에게 답장`}</b>
                              {!gone && <span>{lineSnippet(target)}</span>}
                            </button>
                          );
                        })()}
                        {item.kind === 'comment' && (
                          // Which photo it's on: a little copy of it and its place; a tap opens it.
                          <button className="group-chat__quote" aria-label={`${placeName(item.place)} 사진에 단 댓글, 사진 보기`} onClick={() => openPhoto(item.path)}>
                            {item.photo && <img src={item.photo} alt="" loading="lazy" draggable={false} />}
                            <span>{placeName(item.place)} 사진</span>
                          </button>
                        )}
                        {item.deleted ? <p className="group-chat__text is-deleted">삭제된 메시지예요</p> : <p className="group-chat__text">{item.body}</p>}
                      </>
                    )}
                  </div>
                  <span className="group-chat__meta">
                    {/* How many haven't read it yet (none: nothing); unknown until the reads are in. */}
                    {reads && unreadBy(item, memberIds, reads, me) > 0 && (
                      <span className="group-chat__unread" aria-label={`안 읽은 사람 ${unreadBy(item, memberIds, reads, me)}명`}>
                        {unreadBy(item, memberIds, reads, me)}
                      </span>
                    )}
                    <time className="group-chat__time" dateTime={item.at}>
                      {clock(item.at)}
                    </time>
                  </span>
                </div>
              </div>
            </li>,
          ];
        })}
      </ol>

      {/* Answering a line: which, right over the input (the thread shortens for it). */}
      {replyTo && (
        <div className="group-chat__replying">
          <Reply size={18} strokeWidth={2.4} aria-hidden />
          <div>
            <b>{nameOf(replyTo)}에게 답장</b>
            <span>{lineSnippet(replyTo)}</span>
          </div>
          <button type="button" aria-label="답장 취소" onClick={() => setReplyTo(null)}>
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>
      )}
      <form
        className="group-chat__form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {unseen && !sendFailed && (
          <button className="group-chat__news" type="button" onClick={toNewest}>
            <ArrowDown size={16} strokeWidth={2.6} aria-hidden />새 메시지
          </button>
        )}
        {sendFailed && <p className="group-chat__fail">보내지 못했어요. 다시 시도하세요.</p>}
        {deleteFailed && !sendFailed && <p className="group-chat__fail">삭제하지 못했어요. 다시 시도하세요.</p>}
        <input
          ref={input}
          className="group-chat__input"
          value={text}
          maxLength={COMMENT_MAX}
          placeholder={replyTo ? '답장 보내기' : '그룹에 메시지 보내기'}
          aria-label="메시지"
          enterKeyHint="send"
          onChange={(e) => setText(e.target.value)}
        />
        <button className="photo-comments__send" type="submit" aria-label="보내기" disabled={!text.trim() || sending}>
          <ArrowUp size={20} strokeWidth={2.6} aria-hidden />
        </button>
      </form>

      {menuFor && (
        <ChatLineMenu
          item={menuFor}
          who={nameOf(menuFor)}
          onReply={() => startReply(menuFor)}
          onDeleteAll={menuFor.mine && !menuFor.deleted ? () => setDeletingAll(menuFor) : undefined}
          onDeleteMine={() => deleteForMe(menuFor)}
          onClose={() => setMenuFor(null)}
        />
      )}
      {deletingAll && (
        <ConfirmDialog
          label="모두에게 삭제"
          message={deletingAll.kind === 'photo' ? '이 사진을 그룹에서 삭제합니다.' : deletingAll.kind === 'comment' ? '이 댓글을 모두에게서 삭제합니다.' : '이 메시지를 모두에게서 삭제합니다.'}
          detail={deletingAll.kind === 'photo' ? '그룹 지도·갤러리에서도 사라지고 복구할 수 없어요.' : '삭제한 메시지는 복구할 수 없어요.'}
          onConfirm={() => void deleteForAll(deletingAll)}
          onClose={() => setDeletingAll(null)}
        />
      )}

      {picker && <ChatDayPicker at={picker} days={days} createdAt={group.createdAt} onPick={jumpTo} onClose={() => setPicker(null)} />}

      {photoSeq !== null && photos[photoSeq] && (
        <PhotoViewer
          items={photos.map((p) => {
            const member = who(p);
            return { photo: p.photo, name: placeName(p.place), who: member.nickname, face: <MemberFace member={member} size={32} />, date: galleryDayLabel(dateKey(new Date(p.at)), today) };
          })}
          seq={photoSeq}
          onSeq={onPhotoSeq}
          onClose={() => onPhotoSeq(null)}
          prevLabel="이전 사진"
          nextLabel="다음 사진"
          counted={false}
          commentPath={photos[photoSeq].path ?? null}
          decorPath={photos[photoSeq].path ?? null}
          decorColor={myColor}
          inkOf={inkOf}
          side={<OpenPhotoMarks path={photos[photoSeq].path ?? null} heart={!photos[photoSeq].mine} />}
        />
      )}
    </div>
  );
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * The small month calendar under a tapped day heading: the days with talk
 * on them pressable (the others faint), opening on that heading's month;
 * ‹ › only toward months that have some (or the group's first day). The
 * day the group was made, and the same date every year after, stands on a
 * yellow star. A tap outside or Esc closes it.
 */
function ChatDayPicker({ at, days, createdAt, onPick, onClose }: { at: { day: string; top: number; left: number }; days: Set<string>; createdAt?: string; onPick(day: string): void; onClose(): void }) {
  const born = createdAt ? dateKey(new Date(createdAt)) : null;
  const [view, setView] = useState(() => {
    const [y, m] = at.day.split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const sorted = [...days, ...(born ? [born] : [])].sort();
  const monthKey = (v: { year: number; month: number }) => `${v.year}-${String(v.month + 1).padStart(2, '0')}`;
  const here = monthKey(view);
  const canBack = !!sorted[0] && sorted[0].slice(0, 7) < here;
  const canOn = !!sorted[sorted.length - 1] && sorted[sorted.length - 1].slice(0, 7) > here;
  const today = dateKey();
  // Centred under the heading, kept on screen.
  const width = 296;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, at.left - width / 2));
  return (
    <>
      <div className="chat-days__backdrop" onClick={onClose} aria-hidden />
      <div className="chat-days" role="dialog" aria-label="날짜로 이동" style={{ top: at.top, left, width }}>
        <div className="chat-days__head">
          <button aria-label="이전 달" disabled={!canBack} onClick={() => setView(shiftMonth(view.year, view.month, -1))}>
            <ChevronLeft size={20} strokeWidth={2.4} />
          </button>
          <strong aria-live="polite">
            {view.year}.{String(view.month + 1).padStart(2, '0')}
          </strong>
          <button aria-label="다음 달" disabled={!canOn} onClick={() => setView(shiftMonth(view.year, view.month, 1))}>
            <ChevronRight size={20} strokeWidth={2.4} />
          </button>
        </div>
        <div className="chat-days__grid">
          {WEEKDAYS.map((w) => (
            <span key={w} className="chat-days__weekday">
              {w}
            </span>
          ))}
          {monthGrid(view.year, view.month).map((d) =>
            d.inMonth ? (
              <button
                key={d.key}
                className={`chat-days__day ${d.key === at.day ? 'is-on' : ''} ${d.key === today ? 'is-today' : ''}`}
                disabled={!days.has(d.key)}
                aria-label={isGroupBirthday(d.key, createdAt) ? `${d.key}, 그룹이 생긴 날` : d.key}
                onClick={() => onPick(d.key)}
              >
                <span className={`chat-days__num ${isGroupBirthday(d.key, createdAt) ? 'born-day' : ''}`}>{d.day}</span>
              </button>
            ) : (
              <span key={d.key} />
            ),
          )}
        </div>
      </div>
    </>
  );
}

/**
 * A 대화 line held down: what it says, then 답장하기, 모두에게 삭제하기 (my
 * own lines only) and 나에게만 삭제하기. A modal <dialog>: Esc, the phone's
 * back and a tap outside close it.
 */
function ChatLineMenu({
  item,
  who,
  onReply,
  onDeleteAll,
  onDeleteMine,
  onClose,
}: {
  item: FeedItem;
  who: string;
  onReply(): void;
  onDeleteAll?: () => void;
  onDeleteMine(): void;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialog);
  useEffect(() => {
    if (dialog.current) showModalQuietly(dialog.current);
  }, []);
  // Each choice closes the menu first, then acts (a confirm opens over the page, not over this).
  const pick = (act: () => void) => () => {
    dialog.current?.close();
    act();
  };
  return (
    <dialog
      ref={dialog}
      className="chat-menu"
      aria-label="메시지 메뉴"
      onClose={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onCancel={(e) => e.stopPropagation()}
      onPointerDown={backdrop.onPointerDown}
      onPointerUp={backdrop.onPointerUp}
      onClick={(e) => {
        e.stopPropagation();
        if (backdrop.isBackdropTap(e.target)) dialog.current?.close();
      }}
    >
      <p className="chat-menu__quote">
        <b>{who}</b>
        <span>{lineSnippet(item)}</span>
      </p>
      <div className="chat-menu__actions">
        {!item.deleted && (
          <button onClick={pick(onReply)}>
            <Reply size={20} strokeWidth={2.2} aria-hidden />
            답장하기
          </button>
        )}
        {onDeleteAll && (
          <button className="is-danger" onClick={pick(onDeleteAll)}>
            <Trash2 size={20} strokeWidth={2.2} aria-hidden />
            모두에게 삭제하기
          </button>
        )}
        <button className="is-danger" onClick={pick(onDeleteMine)}>
          <Trash2 size={20} strokeWidth={2.2} aria-hidden />
          나에게만 삭제하기
        </button>
      </div>
    </dialog>
  );
}
