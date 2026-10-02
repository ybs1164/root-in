import { Check, GripVertical } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { COURSE_LIMITS } from '../domain/course';
import { ROUTE_NOTE_MAX } from '../domain/routeBuild';
import { RouteIconFace, RouteIconOptions } from './RouteIconOptions';
import type { CourseStop } from '../types/course';

interface RouteEditTrayProps {
  stops: CourseStop[];
  note: string;
  onNote: (note: string) => void;
  /** A stop dragged in the list from one place to another. */
  onMove: (from: number, to: number) => void;
  /** ✓: keep the changes and leave editing (needs at least two stops). */
  onDone: () => void;
  /** The route's icon (by its name in the list and above it on the map); none by default. */
  icon?: string;
  onIcon: (icon: string | undefined) => void;
}

/**
 * The sheet for editing a saved route, up in the folder sheet's place:
 * the route's icon at the top left (tap for the icon grid), ✓ at the right, the route's description (tap to edit), and its stops
 * in order — drag one by its handle to put it somewhere else in the route.
 * Stops are added and taken out on the map, as when making a route.
 */
export default function RouteEditTray({ stops, note, onNote, onMove, onDone, icon, onIcon }: RouteEditTrayProps) {
  // The icon grid, open under the icon button; a tap anywhere else closes it.
  const [pickingIcon, setPickingIcon] = useState(false);
  const iconBox = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!pickingIcon) return;
    const away = (e: globalThis.PointerEvent) => {
      if (!iconBox.current?.contains(e.target as Node)) setPickingIcon(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [pickingIcon]);
  const listEl = useRef<HTMLOListElement | null>(null);
  // The row being dragged, how far, and where it would land.
  const [drag, setDrag] = useState<{ from: number; dy: number; to: number; rowH: number; startY: number } | null>(null);

  const onGrab = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const row = e.currentTarget.closest('li');
    // Rows are the same height; the gap between them counts too.
    const next = row?.nextElementSibling ?? row?.previousElementSibling;
    const rowH = row && next ? Math.abs(next.getBoundingClientRect().top - row.getBoundingClientRect().top) : (row?.offsetHeight ?? 52);
    setDrag({ from: i, dy: 0, to: i, rowH, startY: e.clientY });
  };
  const onDragMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    const to = Math.max(0, Math.min(stops.length - 1, drag.from + Math.round(dy / drag.rowH)));
    setDrag({ ...drag, dy, to });
  };
  const onDrop = () => {
    if (!drag) return;
    if (drag.to !== drag.from) onMove(drag.from, drag.to);
    setDrag(null);
  };

  // Where each row sits while one is dragged: the dragged one under the
  // finger, the ones it passed shifted a row to make room.
  const shift = (i: number) => {
    if (!drag) return 0;
    if (i === drag.from) return drag.dy;
    if (drag.from < i && i <= drag.to) return -drag.rowH;
    if (drag.to <= i && i < drag.from) return drag.rowH;
    return 0;
  };

  return (
    <section className="route-edit" aria-label="루트 수정">
      <div className="route-edit__head">
        <div ref={iconBox} className="route-edit__icon-box">
          <button
            className={`route-edit__icon ${icon ? '' : 'is-empty'}`}
            aria-label={`대표 아이콘 ${icon ?? '없음'}, 바꾸기`}
            aria-expanded={pickingIcon}
            onClick={() => setPickingIcon((v) => !v)}
          >
            <RouteIconFace icon={icon} />
          </button>
          {pickingIcon && (
            <div className="route-edit__icons folder-picker" role="group" aria-label="대표 아이콘">
              <RouteIconOptions
                value={icon}
                onPick={(i) => {
                  onIcon(i);
                  setPickingIcon(false);
                }}
              />
            </div>
          )}
        </div>
        <button
          className="route-edit__done"
          aria-label="수정 완료"
          disabled={stops.length < COURSE_LIMITS.minStops}
          onClick={onDone}
        >
          <Check size={24} aria-hidden />
        </button>
      </div>
      <div className="route-edit__body">
        <textarea
          className="route-edit__note"
          aria-label="설명"
          placeholder="설명을 적어 보세요"
          value={note}
          maxLength={ROUTE_NOTE_MAX}
          rows={2}
          onChange={(e) => onNote(e.target.value)}
        />
        <hr className="route-edit__rule" />
        <ol ref={listEl} className={`route-edit__stops ${drag ? 'is-sorting' : ''}`} aria-label="정류장 순서">
          {stops.map((s, i) => (
            <li
              key={s.place.id}
              className={`route-edit__stop ${drag?.from === i ? 'is-dragged' : ''}`}
              style={{ transform: shift(i) ? `translateY(${shift(i)}px)` : undefined }}
            >
              <span className="route-edit__num" aria-hidden>
                {/* The number it will have: rows the dragged one passed move up or down one. */}
                {drag?.from === i ? drag.to + 1 : i + 1 + Math.sign(shift(i))}
              </span>
              <span className="route-edit__name">{s.place.name}</span>
              <button
                className="route-edit__grip"
                aria-label={`${s.place.name} 순서 옮기기`}
                onPointerDown={onGrab(i)}
                onPointerMove={onDragMove}
                onPointerUp={onDrop}
                onPointerCancel={() => setDrag(null)}
              >
                <GripVertical size={20} aria-hidden />
              </button>
            </li>
          ))}
        </ol>
        {stops.length < COURSE_LIMITS.minStops && <p className="route-edit__hint">지도에서 핀을 눌러 {COURSE_LIMITS.minStops}곳 이상 골라 주세요.</p>}
      </div>
    </section>
  );
}
