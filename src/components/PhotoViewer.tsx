import { ArrowUp, Camera, ChevronLeft, ChevronRight, Heart, MessageCircle, Star, X } from 'lucide-react';
import { usePhotoMarks, type PhotoMarks } from '../hooks/usePhotoMarks';
import { usePhotoComments } from '../hooks/usePhotoComments';
import { COMMENT_MAX } from '../domain/gallery';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { viewerStep } from '../domain/groups';
import { SWIPE, swipeCommits } from '../domain/appTabs';

/** One photo the viewer pages through; no `photo` = an empty frame (a place with none). */
export interface ViewerItem {
  photo?: string;
  name: string;
  who: string;
  /** Beside the caption: who sent it. */
  face: ReactNode;
  /** Over the photo: the day it's from (the gallery, paging across days). */
  date?: string;
}

/** How far a drag past the first or last photo still moves it (a little give, then it springs back). */
const EDGE_GIVE = 0.25;

/**
 * A photo big over the whole screen (from a group's photo panel or the
 * gallery), on a dark veil: the photo whole (not cropped), and under it the
 * place, who and n / N with ‹ › (an
 * empty frame for a place with no photo). Dragged sideways the photo
 * follows the finger and, let go far or fast enough, pages to the place
 * before or after — stopping at the first and last (it gives a little and
 * springs back) rather than going round as the panel's ‹ › do. The veil,
 * ✕, Esc or the back button closes it, back to where it was opened.
 */
export default function PhotoViewer({
  items,
  seq,
  onSeq,
  onClose,
  prevLabel = '이전 장소',
  nextLabel = '다음 장소',
  counted = true,
  side,
  commentPath,
}: {
  items: ViewerItem[];
  seq: number;
  onSeq(seq: number): void;
  onClose(): void;
  prevLabel?: string;
  nextLabel?: string;
  /** `n / N` after who (the gallery leaves it out). */
  counted?: boolean;
  /** In place of the ‹ › beside the caption (the gallery's 즐겨찾기 star; paging is by drag and the arrow keys). */
  side?: ReactNode;
  /**
   * The shown photo's path, for its comments: a 💬 before `side` opens a
   * line to write one, and they run under the caption as bubbles. Null: a
   * photo that can't have any (no path); left out: no comments here at all.
   */
  commentPath?: string | null;
}) {
  const [writing, setWriting] = useState(false);
  const ping = items[seq];
  const count = items.length;
  // Which way the new photo slides in from (1 = from the right, after a drag or › to the next).
  const [from, setFrom] = useState<-1 | 0 | 1>(0);
  const go = (dir: -1 | 1) => {
    const next = viewerStep(seq, dir, count);
    if (next === null) return;
    setFrom(dir);
    onSeq(next);
  };
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Typing a comment: the arrows move in the text, not between photos.
      else if ((e.target as HTMLElement | null)?.closest?.('input, textarea')) return;
      else if (e.key === 'ArrowLeft') goRef.current(-1);
      else if (e.key === 'ArrowRight') goRef.current(1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  // The drag: the photo is moved straight from the pointer (no re-render a frame).
  const photo = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; t: number; dx: number; on: boolean } | null>(null);
  /** A drag just ended: the click it makes isn't a tap on the veil. */
  const dragged = useRef(false);
  const place = (dx: number, animate: boolean) => {
    const el = photo.current;
    if (!el) return;
    el.style.transition = animate ? 'translate 0.22s var(--slide-ease)' : 'none';
    el.style.translate = dx ? `${dx}px 0` : '';
  };
  const onDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, on: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (!d.on) {
      // Sideways first: a mostly vertical move isn't a page.
      if (Math.abs(dx) < SWIPE.startPx || Math.abs(dx) < Math.abs(e.clientY - d.y)) return;
      d.on = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // Past the first or last photo it only gives a little.
    const edge = viewerStep(seq, dx < 0 ? 1 : -1, count) === null;
    d.dx = edge ? dx * EDGE_GIVE : dx;
    place(d.dx, false);
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.on) return;
    dragged.current = true;
    window.setTimeout(() => (dragged.current = false), 0);
    const width = photo.current?.clientWidth ?? window.innerWidth;
    const velocity = d.dx / Math.max(1, performance.now() - d.t);
    const dir: -1 | 1 = d.dx < 0 ? 1 : -1;
    const commits = viewerStep(seq, dir, count) !== null && swipeCommits(d.dx < 0 ? -1 : 1, d.dx, width, velocity);
    if (commits) {
      place(0, false);
      go(dir);
    } else place(0, true);
  };

  return (
    <div className="group-photo-viewer" role="dialog" aria-modal="true" aria-label={`${ping.name} 사진`} onClick={() => dragged.current || onClose()}>
      <button className="group-photo-viewer__close" aria-label="닫기" onClick={onClose}>
        <X size={22} strokeWidth={2.4} />
      </button>
      <figure className={`group-photo-viewer__figure ${commentPath !== undefined ? 'has-comments' : ''}`} onClick={(e) => e.stopPropagation()}>
        {ping.date && <p className="group-photo-viewer__date">{ping.date}</p>}
        <div
          ref={photo}
          className="group-photo-viewer__drag"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div key={seq} className={`group-photo-viewer__photo ${ping.photo ? '' : 'is-empty'}`} data-from={from || undefined}>
            {ping.photo ? (
              <img src={ping.photo} alt="" draggable={false} />
            ) : (
              <>
                <Camera size={34} strokeWidth={2} aria-hidden />
                <span>아직 사진이 없어요</span>
              </>
            )}
          </div>
        </div>
        <figcaption className="group-photo-viewer__caption">
          {ping.face}
          <span className="group-photo-viewer__text">
            <strong>{ping.name}</strong>
            <span>
              {ping.who}
              {counted && ` · ${seq + 1} / ${count}`}
            </span>
          </span>
          {commentPath && (
            <button
              className={`gallery__mark gallery__comment ${writing ? 'is-on' : ''}`}
              aria-label="댓글 쓰기"
              aria-pressed={writing}
              onClick={(e) => {
                e.stopPropagation();
                setWriting((w) => !w);
              }}
            >
              <MessageCircle size={27} strokeWidth={2} aria-hidden />
            </button>
          )}
          {side ?? (count > 1 && (
            <span className="group-photo-viewer__nav">
              <button aria-label={prevLabel} disabled={seq === 0} onClick={() => go(-1)}>
                <ChevronLeft size={26} strokeWidth={2.4} />
              </button>
              <button aria-label={nextLabel} disabled={seq === count - 1} onClick={() => go(1)}>
                <ChevronRight size={26} strokeWidth={2.4} />
              </button>
            </span>
          ))}
        </figcaption>
        {commentPath !== undefined && <PhotoCommentList path={commentPath} writing={writing && !!commentPath} />}
      </figure>
    </div>
  );
}

/**
 * In place of the viewer's ‹ ›: ♥ (someone else's photo sent to a group,
 * `heart` — tells its sender) then ★ (즐겨찾기, mine alone). Both by the
 * photo's path; no path, no buttons.
 */
export function PhotoMarkButtons({ path, heart, marks }: { path: string | null; heart: boolean; marks: PhotoMarks }) {
  if (!path) return null;
  return (
    <span className="gallery__marks">
      {heart && (
        <button
          className={`gallery__mark gallery__heart ${marks.hearts.has(path) ? 'is-on' : ''}`}
          aria-label="하트"
          aria-pressed={marks.hearts.has(path)}
          onClick={(e) => {
            e.stopPropagation();
            marks.toggleHeart(path);
          }}
        >
          <Heart size={27} strokeWidth={2} aria-hidden />
        </button>
      )}
      <button
        className={`gallery__mark gallery__star ${marks.stars.has(path) ? 'is-on' : ''}`}
        aria-label="즐겨찾기"
        aria-pressed={marks.stars.has(path)}
        onClick={(e) => {
          e.stopPropagation();
          marks.toggleStar(path);
        }}
      >
        <Star size={28} strokeWidth={2} aria-hidden />
      </button>
    </span>
  );
}

/**
 * ♥ ★ with their own marks, read only while a big photo is open (a group's
 * map, TODAY). `hearts` false: never a heart here (TODAY's photos are mine).
 */
export function OpenPhotoMarks({ path, heart, hearts = true }: { path: string | null; heart: boolean; hearts?: boolean }) {
  const marks = usePhotoMarks(hearts);
  return <PhotoMarkButtons path={path} heart={hearts && heart} marks={marks} />;
}

/**
 * Under the big photo's caption: its comments one under another as speech
 * bubbles (mine on the right, in the accent colour; others' on the left
 * with their name), oldest first, scrolled to the newest. While `writing`,
 * a line to write one at the bottom (Enter or ↑ sends).
 */
function PhotoCommentList({ path, writing }: { path: string | null; writing: boolean }) {
  const { comments, failed, add } = usePhotoComments(path);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments]);
  // Another photo: what was being written for the last one goes.
  useEffect(() => {
    setText('');
    setError(false);
  }, [path]);
  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const ok = await add(text);
    setSending(false);
    setError(!ok);
    if (ok) setText('');
  };
  return (
    <div className="photo-comments">
      {comments && comments.length > 0 && (
        <ol ref={list} className="photo-comments__list" aria-label="댓글">
          {comments.map((c) => (
            <li key={c.id} className={`photo-comments__item ${c.mine ? 'is-mine' : ''}`}>
              {!c.mine && <span className="photo-comments__who">{c.nickname}</span>}
              <p className="photo-comments__bubble">{c.body}</p>
            </li>
          ))}
        </ol>
      )}
      {failed && <p className="photo-comments__note">댓글을 불러오지 못했어요.</p>}
      {writing && (
        <form
          className="photo-comments__form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            className="photo-comments__input"
            value={text}
            maxLength={COMMENT_MAX}
            placeholder="댓글을 입력하세요"
            aria-label="댓글"
            autoFocus
            enterKeyHint="send"
            onChange={(e) => setText(e.target.value)}
          />
          <button className="photo-comments__send" type="submit" aria-label="댓글 보내기" disabled={!text.trim() || sending}>
            <ArrowUp size={20} strokeWidth={2.6} aria-hidden />
          </button>
        </form>
      )}
      {error && <p className="photo-comments__note">댓글을 보내지 못했어요.</p>}
    </div>
  );
}
