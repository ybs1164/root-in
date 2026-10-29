import { Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
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
}) {
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
      <figure className="group-photo-viewer__figure" onClick={(e) => e.stopPropagation()}>
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
      </figure>
    </div>
  );
}
