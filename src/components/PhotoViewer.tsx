import { ArrowUp, Camera, ChevronLeft, ChevronRight, Heart, MessageCircle, Star, X } from 'lucide-react';
import { usePhotoDoodle } from './PhotoDoodle';
import { usePhotoMarks, type PhotoMarks } from '../hooks/usePhotoMarks';
import { usePhotoComments } from '../hooks/usePhotoComments';
import { COMMENT_MAX } from '../domain/gallery';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { viewerStep } from '../domain/groups';
import { SWIPE, swipeCommits } from '../domain/appTabs';
import { motionMs, slideEase, SLIDE_OFF_MS, SPRING_BACK_MS } from '../lib/swipeSlide';

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
/** A pull down this far (px) has cleared the veil, and the photo shrinks a little as it goes. */
const PULL_CLEAR_PX = 320;
const PULL_SHRINK = 0.15;
/** A drag's own click on the veil or a button comes just after it, on some phones a while after. */
const AFTER_DRAG_MS = 350;
/** Two fingers on the photo zoom it in this far (1 = as it opened, the whole photo). */
export const PHOTO_ZOOM = { max: 5, double: 2.5 } as const;
/** Two taps this close in time and place on the photo: zoom in there, or back out. */
const DOUBLE_TAP = { ms: 300, px: 30 } as const;

/** A zoomed photo's place: scaled by `s` about its top left, moved by `x` `y` (px). */
export interface PhotoZoom {
  s: number;
  x: number;
  y: number;
}
export const NO_ZOOM: PhotoZoom = { s: 1, x: 0, y: 0 };

/** Where the photo sits in the zoomed box (unzoomed, px from its top left) and its size. */
export interface ZoomFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Kept so the zoomed photo always covers where it was (`frame`): no gap
 * opens at any edge, and below 1× it's back to the whole photo.
 */
export function clampZoom(z: PhotoZoom, frame: ZoomFrame): PhotoZoom {
  const s = Math.min(PHOTO_ZOOM.max, Math.max(1, z.s));
  const keep = (at: number, start: number, size: number) => Math.min(start - s * start, Math.max(start + size - s * (start + size), at));
  return { s, x: keep(z.x, frame.x, frame.w), y: keep(z.y, frame.y, frame.h) };
}

/**
 * Two fingers from `from` (their midpoint and spread, the zoom then) to
 * `mid` / `spread` now: the point of the photo first under their middle
 * stays under it as it scales (`box` = the photo's box on screen, unzoomed).
 */
export function pinchZoom(from: { zoom: PhotoZoom; mid: { x: number; y: number }; spread: number }, mid: { x: number; y: number }, spread: number, box: { left: number; top: number }): PhotoZoom {
  const s = Math.min(PHOTO_ZOOM.max, Math.max(1, from.zoom.s * (spread / Math.max(1, from.spread))));
  const px = (from.mid.x - box.left - from.zoom.x) / from.zoom.s;
  const py = (from.mid.y - box.top - from.zoom.y) / from.zoom.s;
  return { s, x: mid.x - box.left - px * s, y: mid.y - box.top - py * s };
}

/**
 * A photo big over the whole screen (from a group's photo panel or the
 * gallery), on a dark veil: the photo whole (not cropped), and under it the
 * place, who and n / N with ‹ › (an
 * empty frame for a place with no photo). Dragged sideways the photo
 * follows the finger and, let go far or fast enough, pages to the photo
 * before or after — stopping at the first and last (it gives a little and
 * springs back). Pulled down from anywhere, the photo follows the finger as
 * the veil clears and, let go far or fast enough, drops off the screen and
 * closes. The veil, ✕, Esc or the back button also close it, back to where it
 * was opened.
 */
export default function PhotoViewer({
  items,
  seq,
  onSeq,
  onClose,
  prevLabel = '이전 사진',
  nextLabel = '다음 사진',
  counted = true,
  side,
  commentPath,
  decorPath,
  decorColor,
  inkOf,
  startWriting = false,
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
  /**
   * The shown photo's path, for its doodles (every member's pen, stickers
   * and text, drawn over it). Left out: none here; null: a photo with no path.
   */
  decorPath?: string | null;
  /**
   * My colour in this group (`member-N`): the tools (펜 · 스티커 · 텍스트) show
   * over the photo and draw in it, only inside the photo. Absent: the
   * doodles are only shown (the gallery).
   */
  decorColor?: string | null;
  /** Each doodler's colour now (`member-N`), by user id: their doodles are drawn in it, not the one they used then. */
  inkOf?: (userId: string) => string | null;
  /** Opens with the comment line out, its field focused (the photo panel's 💬). */
  startWriting?: boolean;
}) {
  const [writing, setWriting] = useState(startWriting);
  const doodle = usePhotoDoodle(decorPath ?? null, decorColor ?? null, inkOf);
  const tool = doodle.active;
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
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const putAway = useRef(doodle.putAway);
  putAway.current = doodle.putAway;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toolRef.current ? putAway.current() : onClose();
      // Typing a comment: the arrows move in the text, not between photos.
      else if ((e.target as HTMLElement | null)?.closest?.('input, textarea')) return;
      else if (e.key === 'ArrowLeft') goRef.current(-1);
      else if (e.key === 'ArrowRight') goRef.current(1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  // The drag: the photo is moved straight from the pointer (no re-render a frame).
  const root = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; t: number; dx: number; dy: number; onPhoto: boolean; mode: 'page' | 'close' | 'pan' | null } | null>(null);
  // Two fingers zoom the photo (past how big it opened) and, zoomed, one moves it around.
  const zoomBox = useRef<HTMLDivElement>(null);
  const zoom = useRef<PhotoZoom>(NO_ZOOM);
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ zoom: PhotoZoom; mid: { x: number; y: number }; spread: number } | null>(null);
  const lastTap = useRef<{ x: number; y: number; t: number } | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const showZoom = (z: PhotoZoom, animate = false) => {
    zoom.current = z;
    const el = zoomBox.current;
    if (el) {
      el.style.transition = animate ? `transform ${motionMs(SPRING_BACK_MS)}ms var(--slide-ease)` : 'none';
      el.style.transform = z.s === 1 && !z.x && !z.y ? '' : `translate(${z.x}px, ${z.y}px) scale(${z.s})`;
    }
    setZoomed(z.s > 1);
  };
  /** Back to the whole photo, the zoom eased out (paging, a tool, a new photo). */
  const unzoom = (animate = true) => {
    if (zoom.current.s !== 1 || zoom.current.x || zoom.current.y) showZoom(NO_ZOOM, animate);
  };
  const boxRect = () => photo.current?.getBoundingClientRect() ?? null;
  /** The photo inside the zoomed box, as laid out (the box is as wide as the figure; a square photo may be narrower). */
  const frame = (): ZoomFrame | null => {
    const el = zoomBox.current?.firstElementChild as HTMLElement | null | undefined;
    return el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null;
  };
  const kept = (z: PhotoZoom) => {
    const f = frame();
    return f ? clampZoom(z, f) : z;
  };
  const settleZoom = () => {
    // Let go about as it opened: all the way back out.
    if (zoom.current.s < 1.05) return showZoom(NO_ZOOM, true);
    showZoom(kept(zoom.current), true);
  };
  useEffect(() => {
    zoom.current = NO_ZOOM;
    if (zoomBox.current) zoomBox.current.style.transform = '';
    setZoomed(false);
  }, [seq]);
  useEffect(() => {
    if (tool) unzoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);
  const spreadOf = () => {
    const [a, b] = [...fingers.current.values()];
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, spread: Math.hypot(b.x - a.x, b.y - a.y) };
  };
  /** Two fingers down on a photo (no tool out): whatever one finger was doing gives way to the pinch. */
  const startPinch = () => {
    const d = drag.current;
    if (d?.mode === 'close') letGoPull(d.dy, false);
    else if (d?.mode === 'page') place(0, true);
    drag.current = null;
    lastTap.current = null;
    pinch.current = { zoom: zoom.current, ...spreadOf() };
  };
  /** A drag just ended: the click it makes isn't a tap on the veil. */
  const dragged = useRef(false);
  const closing = useRef(false);
  const place = (dx: number, animate: boolean) => {
    const el = photo.current;
    if (!el) return;
    el.style.transition = animate ? 'translate 0.22s var(--slide-ease)' : 'none';
    el.style.translate = dx ? `${dx}px 0` : '';
  };
  /** Where a pull down has the photo: `transform`, as the figure's `translate` holds its resting place. */
  const pulledTo = (dy: number) => `translateY(${dy}px) scale(${1 - Math.min(1, dy / PULL_CLEAR_PX) * PULL_SHRINK})`;
  const setVeil = (dy: number, ms = 0) => {
    const el = root.current;
    if (!el) return;
    el.style.setProperty('--veil-ms', `${ms}ms`);
    el.style.setProperty('--veil', String(1 - Math.min(1, dy / PULL_CLEAR_PX)));
  };
  const pull = (dy: number) => {
    if (figure.current) figure.current.style.transform = pulledTo(dy);
    setVeil(dy);
  };
  const letGoPull = (dy: number, commits: boolean) => {
    const el = figure.current;
    if (!el) return commits ? onClose() : undefined;
    el.style.transform = '';
    if (commits) {
      closing.current = true;
      const ms = motionMs(SLIDE_OFF_MS);
      setVeil(PULL_CLEAR_PX, ms);
      el.animate([{ transform: pulledTo(dy) }, { transform: `translateY(${window.innerHeight}px) scale(${1 - PULL_SHRINK})` }], {
        duration: ms,
        easing: slideEase(),
        fill: 'forwards',
      }).finished.then(() => onClose(), () => onClose());
      return;
    }
    const ms = motionMs(SPRING_BACK_MS);
    setVeil(0, ms);
    el.animate([{ transform: pulledTo(dy) }, { transform: 'none' }], { duration: ms, easing: slideEase() });
  };
  const onDown = (e: React.PointerEvent) => {
    // A tool out: the finger doodles. A field moves its caret, a long list of comments scrolls.
    if (tool || closing.current) return;
    const target = e.target as Element;
    if (target.closest('input, textarea, .photo-comments__list')) return;
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.current.size === 2 && ping.photo) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Not a live pointer: its moves still come while over the viewer.
      }
      return startPinch();
    }
    if (!e.isPrimary || fingers.current.size > 1) return;
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      dx: 0,
      dy: 0,
      onPhoto: !!photo.current?.contains(target),
      mode: null,
    };
  };
  const onMove = (e: React.PointerEvent) => {
    if (fingers.current.has(e.pointerId)) fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pinch.current;
    if (p && fingers.current.size >= 2) {
      const r = boxRect();
      if (!r) return;
      const now = spreadOf();
      return showZoom(pinchZoom(p, now.mid, now.spread, r));
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.mode === 'pan') {
      d.x = e.clientX;
      d.y = e.clientY;
      return showZoom(kept({ ...zoom.current, x: zoom.current.x + dx, y: zoom.current.y + dy }));
    }
    if (!d.mode) {
      if (Math.abs(dx) < SWIPE.startPx && Math.abs(dy) < SWIPE.startPx) return;
      // Zoomed in, one finger moves the photo around (no paging, no closing).
      if (zoom.current.s > 1) {
        d.mode = 'pan';
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // As below.
        }
        return;
      }
      // Down from anywhere closes; only the photo itself pages sideways; up is nothing.
      if (Math.abs(dy) >= Math.abs(dx) ? dy < 0 : !d.onPhoto) return void (drag.current = null);
      d.mode = Math.abs(dy) >= Math.abs(dx) ? 'close' : 'page';
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Not a live pointer: moves still come while over the viewer.
      }
    }
    if (d.mode === 'close') {
      d.dy = Math.max(0, dy);
      return pull(d.dy);
    }
    // Past the first or last photo it only gives a little.
    const edge = viewerStep(seq, dx < 0 ? 1 : -1, count) === null;
    d.dx = edge ? dx * EDGE_GIVE : dx;
    place(d.dx, false);
  };
  const swallowClick = () => {
    dragged.current = true;
    window.setTimeout(() => (dragged.current = false), AFTER_DRAG_MS);
  };
  const onUp = (e: React.PointerEvent) => {
    fingers.current.delete(e.pointerId);
    if (pinch.current) {
      if (fingers.current.size >= 2) return;
      pinch.current = null;
      swallowClick();
      settleZoom();
      // The finger left on it moves the zoomed photo on from here.
      const [id, at] = [...fingers.current.entries()][0] ?? [];
      if (id !== undefined && at && zoom.current.s > 1) drag.current = { id, x: at.x, y: at.y, t: performance.now(), dx: 0, dy: 0, onPhoto: true, mode: 'pan' };
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (!d.mode) {
      // A tap on the photo; two of them, quickly in one spot: zoom in there, or back out.
      if (!d.onPhoto || !ping.photo || e.type === 'pointercancel') return;
      const t = lastTap.current;
      const now = performance.now();
      lastTap.current = { x: e.clientX, y: e.clientY, t: now };
      if (!t || now - t.t > DOUBLE_TAP.ms || Math.hypot(e.clientX - t.x, e.clientY - t.y) > DOUBLE_TAP.px) return;
      lastTap.current = null;
      const r = boxRect();
      if (!r) return;
      if (zoom.current.s > 1) return showZoom(NO_ZOOM, true);
      const at = { x: e.clientX, y: e.clientY };
      return showZoom(kept(pinchZoom({ zoom: NO_ZOOM, mid: at, spread: 1 }, at, PHOTO_ZOOM.double, r)), true);
    }
    swallowClick();
    if (d.mode === 'pan') return;
    const width = photo.current?.clientWidth ?? window.innerWidth;
    const elapsed = Math.max(1, performance.now() - d.t);
    const cancelled = e.type === 'pointercancel';
    if (d.mode === 'close') return letGoPull(d.dy, !cancelled && swipeCommits(1, d.dy, width, d.dy / elapsed));
    const velocity = d.dx / elapsed;
    const dir: -1 | 1 = d.dx < 0 ? 1 : -1;
    const commits = !cancelled && viewerStep(seq, dir, count) !== null && swipeCommits(d.dx < 0 ? -1 : 1, d.dx, width, velocity);
    if (commits) {
      place(0, false);
      go(dir);
    } else place(0, true);
  };

  return (
    <div
      ref={root}
      className="group-photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${ping.name} 사진`}
      onClick={() => onClose()}
      onClickCapture={(e) => {
        // A drag that began on a button or the photo isn't a press of it.
        if (dragged.current) e.stopPropagation();
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={(e) => {
        // A trackpad's pinch (ctrl + wheel) on a computer zooms the photo about the pointer.
        if (!e.ctrlKey || tool || !ping.photo) return;
        const r = boxRect();
        if (!r) return;
        const at = { x: e.clientX, y: e.clientY };
        const next = pinchZoom({ zoom: zoom.current, mid: at, spread: 100 }, at, 100 * Math.exp(-e.deltaY * 0.01), r);
        showZoom(next.s < 1.02 ? NO_ZOOM : kept(next));
      }}
    >
      <button className="group-photo-viewer__close" aria-label="닫기" onClick={onClose}>
        <X size={22} strokeWidth={2.4} />
      </button>
      <figure ref={figure} className={`group-photo-viewer__figure ${commentPath !== undefined ? 'has-comments' : ''}`} onClick={(e) => e.stopPropagation()}>
        {ping.date && <p className="group-photo-viewer__date">{ping.date}</p>}
        {ping.photo && doodle.tools}
        <div ref={photo} className={`group-photo-viewer__drag ${zoomed ? 'is-zoomed' : ''}`}>
          {/* Two fingers zoom this (the photo and its doodles together) past how big it opened. */}
          <div ref={zoomBox} className="group-photo-viewer__zoom">
          <div key={seq} className={`group-photo-viewer__photo ${ping.photo ? '' : 'is-empty'} ${decorPath !== undefined && ping.photo ? 'has-doodles' : ''}`} data-from={from || undefined}>
            {ping.photo ? (
              <>
                <img src={ping.photo} alt="" draggable={false} />
                {doodle.layers}
              </>
            ) : (
              <>
                <Camera size={34} strokeWidth={2} aria-hidden />
                <span>아직 사진이 없어요</span>
              </>
            )}
          </div>
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
        {doodle.tray}
        {commentPath !== undefined && <PhotoCommentList path={commentPath} writing={writing && !!commentPath} onSent={() => setWriting(false)} />}
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
 * a line to write one at the bottom (Enter or ↑ sends); once one is sent
 * the line goes (`onSent`) until 💬 is pressed again.
 */
function PhotoCommentList({ path, writing, onSent }: { path: string | null; writing: boolean; onSent(): void }) {
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
    if (!ok) return;
    setText('');
    onSent();
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
