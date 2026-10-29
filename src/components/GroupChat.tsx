import { ArrowUp, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { COMMENT_MAX, galleryDayLabel, type FeedItem } from '../domain/gallery';
import { GROUP_LIMITS, isGroupBirthday, memberColor, type Group, type GroupMember } from '../domain/groups';
import { dateKey } from '../domain/diary';
import { monthGrid, shiftMonth } from '../domain/calendar';
import { groupService } from '../services/groupService';
import { MemberFace } from './WeNowPage';
import PhotoViewer, { OpenPhotoMarks } from './PhotoViewer';

/** The day calendar's height (its six weeks), to flip it over a pill low on the screen. */
const PICKER_HEIGHT = 330;

/** How often the 대화 reads itself again while it's open. */
const REFRESH_MS = 30_000;

/** Someone no longer in the group: no face, a neutral name. */
const goneMember = (userId: string): GroupMember => ({ userId, slot: 0, color: 0, nickname: '나간 그룹원', alias: null, photo: null, pings: [] });

const placeName = (name: string | undefined) => name || '이름 없는 곳';

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
}: {
  group: Group;
  me: string | null;
  /** The thread's photo open big (among its photos, oldest first); App holds it, for the back button. */
  photoSeq: number | null;
  onPhotoSeq(seq: number | null): void;
  onClose(): void;
}) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const read = useCallback(async () => {
    const feed = await groupService.feed(group.id);
    if (feed === 'error') setFailed(true), setItems((now) => now ?? []);
    else setFailed(false), setItems(feed);
  }, [group.id]);
  useEffect(() => {
    void read();
    const timer = window.setInterval(() => void read(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [read]);
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
  const photos = useMemo(() => (items ?? []).filter((i) => i.kind === 'photo'), [items]);
  // My colour here: the doodle tools' one ink on a photo opened big.
  const myMember = group.members.find((m) => m.userId === me);
  const myColor = myMember ? `member-${myMember.color % GROUP_LIMITS.members}` : null;
  const openPhoto = (path: string | undefined) => {
    const seq = photos.findIndex((p) => p.path === path);
    if (seq >= 0) onPhotoSeq(seq);
  };

  // Kept at the newest: on opening, and whenever a line comes in — not on a
  // re-read that brought nothing new (it'd pull away from a day jumped to).
  const list = useRef<HTMLOListElement>(null);
  const newest = useRef<string | null>(null);
  useEffect(() => {
    const el = list.current;
    const last = items?.length ? items[items.length - 1].id : null;
    if (!el || last === newest.current) return;
    newest.current = last;
    el.scrollTop = el.scrollHeight;
  }, [items]);

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
  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const ok = await groupService.sendMessage(group.id, text);
    setSending(false);
    setSendFailed(!ok);
    if (!ok) return;
    setText('');
    void read();
  };

  useEffect(() => {
    if (photoSeq !== null) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && (picker ? setPicker(null) : onClose());
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [photoSeq, onClose, picker]);

  const today = dateKey();
  let lastDay = '';
  return (
    <div className="group-chat" role="dialog" aria-modal="true" aria-label={`${group.name} 대화`}>
      <header className="group-chat__head">
        <button className="gallery__back" aria-label="닫기" onClick={onClose}>
          <ChevronLeft size={24} strokeWidth={2.2} />
        </button>
        <h2 className="group-chat__title">TALK</h2>
        <p className="group-chat__group">{group.name}</p>
      </header>

      <ol ref={list} className="group-chat__list" aria-label="대화 내역">
        {items === null && <li className="gallery__note">대화를 불러오는 중…</li>}
        {items?.length === 0 && !failed && <li className="gallery__note">아직 대화가 없어요. 사진을 보내거나 말을 걸어 보세요.</li>}
        {failed && <li className="gallery__note">대화를 불러오지 못했어요.</li>}
        {items?.map((item) => {
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
            <li key={item.id} className={`group-chat__line ${item.mine ? 'is-mine' : ''}`} style={{ '--member': memberColor(member.color) } as CSSProperties}>
              {/* Mine on the right, bare; everyone else's with their face and name. */}
              {!item.mine && <MemberFace member={member} size={36} />}
              <div className="group-chat__said">
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
                        {item.kind === 'comment' && (
                          // Which photo it's on: a little copy of it and its place; a tap opens it.
                          <button className="group-chat__quote" aria-label={`${placeName(item.place)} 사진에 단 댓글, 사진 보기`} onClick={() => openPhoto(item.path)}>
                            {item.photo && <img src={item.photo} alt="" loading="lazy" draggable={false} />}
                            <span>{placeName(item.place)} 사진</span>
                          </button>
                        )}
                        <p className="group-chat__text">{item.body}</p>
                      </>
                    )}
                  </div>
                  <time className="group-chat__time" dateTime={item.at}>
                    {clock(item.at)}
                  </time>
                </div>
              </div>
            </li>,
          ];
        })}
      </ol>

      <form
        className="group-chat__form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {sendFailed && <p className="group-chat__fail">보내지 못했어요. 다시 시도하세요.</p>}
        <input
          className="group-chat__input"
          value={text}
          maxLength={COMMENT_MAX}
          placeholder="그룹에 메시지 보내기"
          aria-label="메시지"
          enterKeyHint="send"
          onChange={(e) => setText(e.target.value)}
        />
        <button className="photo-comments__send" type="submit" aria-label="보내기" disabled={!text.trim() || sending}>
          <ArrowUp size={20} strokeWidth={2.6} aria-hidden />
        </button>
      </form>

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
