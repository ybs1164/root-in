import { Camera, MessageCircle, MoreHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { PhotoDecorLayer } from '../domain/gallery';
import { DoodleLayers } from './PhotoDoodle';

/**
 * Under the title: a tapped place's photo (a tap opens it big), when it was
 * taken, the place, 💬 ♥ ★, and ✕ — or, for my own place, … with 사진 삭제 ·
 * 핀 삭제. A faint thread in `color` runs down to the marker (`anchor`, a
 * selector), wherever it moves. A group's map and TODAY both use it.
 */
export default function PhotoPanel({
  name,
  color,
  anchor,
  placeKey,
  photo,
  time,
  marks,
  doodles,
  inkOf,
  onOpen,
  onComment,
  onClose,
  onDelete,
  className = '',
  centred = false,
}: {
  name: string;
  /** The frame's and the thread's colour (a CSS colour). */
  color: string;
  /** The marker the thread runs down to. */
  anchor: string;
  /** Which place it's on: the thread re-finds its marker when it changes. */
  placeKey: string;
  photo?: string;
  time: string;
  /** ♥ ★ for the photo, as on it big. */
  marks: ReactNode;
  /** Its doodles, everyone's, drawn over it as on it big. */
  doodles?: PhotoDecorLayer[];
  inkOf?: (userId: string) => string | null;
  onOpen(): void;
  /** 💬: open it big, writing a comment. */
  onComment(): void;
  onClose(): void;
  /** With it, … in place of ✕: a little menu of 사진 삭제 (with a photo) and 핀 삭제. */
  onDelete?(kind: 'photo' | 'place'): void;
  className?: string;
  /** The thread runs to the marker's middle (else its left edge, a group's ping dot). */
  centred?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const more = useRef<HTMLDivElement>(null);
  // Another place or photo, or a press anywhere outside it: the menu folds.
  useEffect(() => setMenu(false), [placeKey, photo]);
  useEffect(() => {
    if (!menu) return;
    const away = (event: PointerEvent) => {
      if (!more.current?.contains(event.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [menu]);
  const panel = useRef<HTMLElement>(null);
  const thread = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const line = thread.current;
      const box = panel.current?.getBoundingClientRect();
      const marker = document.querySelector<HTMLElement>(anchor);
      if (line && box && marker) {
        const at = marker.getBoundingClientRect();
        const head = Math.min(at.top, ...[...marker.children].map((c) => c.getBoundingClientRect().top));
        const height = Math.max(0, head - box.bottom - 4);
        line.style.transform = `translate(${Math.round(centred ? at.left + at.width / 2 : at.left)}px, ${Math.round(box.bottom)}px)`;
        line.style.height = `${height}px`;
      } else if (line) line.style.height = '0px';
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [anchor, placeKey, centred]);
  return (
    <>
      <span ref={thread} className="group-photo-thread" style={{ '--member': color } as CSSProperties} aria-hidden />
      <section ref={panel} className={`group-photo-panel ${className}`} style={{ '--member': color } as CSSProperties} aria-label={`${name} 사진`}>
        {photo ? (
          // Tap the photo to see it big.
          <button key={`${placeKey}|${photo}`} className="group-photo-panel__photo" aria-label="사진 크게 보기" onClick={onOpen}>
            <img src={photo} alt="" draggable={false} />
            {doodles && <DoodleLayers layers={doodles} inkOf={inkOf} />}
          </button>
        ) : (
          <div key={placeKey} className="group-photo-panel__photo is-empty">
            <Camera size={26} strokeWidth={2} aria-hidden />
            <span>아직 사진이 없어요</span>
          </div>
        )}
        <div className="group-photo-panel__text">
          <div className="group-photo-panel__top">
            {/* When the photo was taken (or they were there); who it is, the pass below says. */}
            <time className="group-photo-panel__time">{time}</time>
            {onDelete ? (
              <div ref={more} className="group-photo-panel__more">
                <button className="group-photo-panel__close" aria-label="더보기" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((open) => !open)}>
                  <MoreHorizontal size={20} strokeWidth={2.4} />
                </button>
                {menu && (
                  <div className="group-photo-panel__menu" role="menu">
                    {photo && (
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenu(false);
                          onDelete('photo');
                        }}
                      >
                        사진 삭제
                      </button>
                    )}
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenu(false);
                        onDelete('place');
                      }}
                    >
                      핀 삭제
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="group-photo-panel__close" aria-label="사진 닫기" onClick={onClose}>
                <X size={18} strokeWidth={2.4} />
              </button>
            )}
          </div>
          <strong className="group-photo-panel__name">{name}</strong>
          {/* As under the photo big: 💬 opens it big to write, ♥ ★ right here. */}
          {photo && (
            <div className="group-photo-panel__foot">
              <button className="gallery__mark gallery__comment" aria-label="댓글 쓰기" onClick={onComment}>
                <MessageCircle size={27} strokeWidth={2} aria-hidden />
              </button>
              {marks}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
