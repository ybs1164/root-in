import { Check, GripVertical, Inbox, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { COURSE_LIMITS } from '../domain/course';
import { ROUTE_NOTE_MAX } from '../domain/routeBuild';
import type { RouteFolder } from '../domain/routeFolders';
import type { CourseStop } from '../types/course';

interface RouteEditTrayProps {
  stops: CourseStop[];
  note: string;
  onNote: (note: string) => void;
  /** A stop dragged in the list from one place to another. */
  onMove: (from: number, to: number) => void;
  /** A stop's number tapped: it leaves the route (as tapping its number on the map does). */
  onRemove: (index: number) => void;
  /** ✓: keep the changes and leave editing (needs at least two stops). */
  onDone: () => void;
  folders: RouteFolder[];
  /** The folder the route goes in on ✓ (null = 미분류). */
  folder: string | null;
  onFolder: (folder: string | null) => void;
  /** The trash at the sheet's bottom right: deletes the whole route (the app asks first). */
  onDelete: () => void;
}

/**
 * The sheet for editing a saved route, up in the folder sheet's place:
 * its folder at the top left (tap for 미분류 and the folders), ✓ at the top
 * right, the route's description (tap to edit), and its stops
 * in order — drag one by its handle to put it somewhere else in the route.
 * Stops are added and taken out on the map, as when making a route.
 */
export default function RouteEditTray({ stops, note, onNote, onMove, onRemove, onDone, folders, folder, onFolder, onDelete }: RouteEditTrayProps) {
  // The folder grid, open above the folder button; a tap anywhere else closes it.
  const [pickingFolder, setPickingFolder] = useState(false);
  const folderBox = useRef<HTMLDivElement | null>(null);
  // The description grows to its text, so all of it shows however many lines it runs to.
  const noteEl = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = noteEl.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [note]);
  useEffect(() => {
    if (!pickingFolder) return;
    const away = (e: globalThis.PointerEvent) => {
      if (!folderBox.current?.contains(e.target as Node)) setPickingFolder(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [pickingFolder]);
  const filed = folders.find((f) => f.id === folder) ?? null;

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
        <div ref={folderBox} className="route-edit__folder-box">
          {/* Its folder as an index tab standing out of the sheet's top edge, as on the folder sheet: its icon, or 미분류's tray. */}
          <button
            className="route-edit__folder"
            aria-label={`폴더 ${filed?.name ?? '미분류'}, 바꾸기`}
            aria-expanded={pickingFolder}
            onClick={() => setPickingFolder((v) => !v)}
          >
            {filed?.icon ?? <Inbox size={20} aria-hidden />}
          </button>
          {pickingFolder && (
            <div className="route-edit__folders folder-picker" role="group" aria-label="폴더">
              <button
                className={`folder-picker__opt ${!filed ? 'is-on' : ''}`}
                aria-label="미분류"
                aria-pressed={!filed}
                onClick={() => {
                  onFolder(null);
                  setPickingFolder(false);
                }}
              />
              {folders.map((f) => (
                <button
                  key={f.id}
                  className={`folder-picker__opt ${filed?.id === f.id ? 'is-on' : ''}`}
                  aria-label={f.name}
                  aria-pressed={filed?.id === f.id}
                  onClick={() => {
                    onFolder(f.id);
                    setPickingFolder(false);
                  }}
                >
                  {f.icon}
                </button>
              ))}
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
          ref={noteEl}
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
              <button
                className="route-edit__num"
                aria-label={`${i + 1}번 ${s.place.name} 루트에서 빼기`}
                disabled={!!drag}
                onClick={() => onRemove(i)}
              >
                {/* The number it will have: rows the dragged one passed move up or down one. */}
                {drag?.from === i ? drag.to + 1 : i + 1 + Math.sign(shift(i))}
              </button>
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
      {/* Deleting the whole route, at the bottom right like the folder sheet's 다중 선택 trash. */}
      <button className="route-edit__trash" aria-label="루트 삭제" onClick={onDelete}>
        <Trash2 size={22} aria-hidden />
      </button>
    </section>
  );
}
