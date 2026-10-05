import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { categoryStyle, isUncategorized, orderedCategories, UNCATEGORIZED, pinColorCss } from '../domain/pin';
import type { Pin, PinCategory, PinTint } from '../types/pin';
import ConfirmDialog from './ConfirmDialog';
import PinGlyph from './PinGlyph';

interface CategoryManagerProps {
  categories: PinCategory[];
  pins: Pin[];
  pinCounts: Map<string, number>;
  /** 편집 상태 (the sheet's pen): rows get a drag handle on the left and ✎ 🗑 on the right. */
  editing: boolean;
  /** A row's ✎ while editing: open 핀 카테고리 편집 for it. */
  onEditCategory: (category: PinCategory) => void;
  /** ↑/↓ on a focused drag handle (the keyboard's way to reorder). */
  onMove: (id: string, direction: -1 | 1) => void;
  /** A row dragged to `to` in the order. */
  onDrop: (id: string, to: number) => void;
  onDelete: (id: string) => void;
  /** A pin picked from a category's list: as if it were tapped on the map. */
  onPickPin: (id: string) => void;
  /** A long press on a row out of 편집 상태 turns it on. */
  onStartEditing: () => void;
}

/** Hold this long without moving to lift a row (moving sooner scrolls the list). */
const HOLD_MS = 450;
const HOLD_SLOP = 8;

interface Drag {
  id: string;
  startY: number;
  dy: number;
  /** Where it would land in the order. */
  to: number;
  rowH: number;
}

/**
 * 핀 카테고리 (CategorySheet). Out of 편집 상태 a row opens the names of
 * its pins (tap one to see it on the map); in it, a row shows a drag handle
 * on its left and ✎ 🗑 where its count was; ✎ edits it, and the handle (or a
 * long press anywhere on the row) lifts it to drag. A long press on a row
 * out of 편집 상태 turns 편집 상태 on with that row picked and lifted.
 */
export default function CategoryManager({
  categories,
  pins,
  pinCounts,
  editing,
  onEditCategory,
  onMove,
  onDrop,
  onDelete,
  onPickPin,
  onStartEditing,
}: CategoryManagerProps) {
  const [open, setOpen] = useState<string | null>(null);
  // The category whose bin was tapped, waiting on the confirm.
  const [deleting, setDeleting] = useState<PinCategory | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  // The row a long press brought into 편집 상태 with: shown picked until the
  // next press or until 편집 상태 ends.
  const [picked, setPicked] = useState<string | null>(null);
  const hold = useRef<{ timer: number; id: string; x: number; y: number; li: HTMLElement | null } | null>(null);
  // Window listeners for the press in progress (a hold, then maybe a drag).
  // On the window, not the row: a long press out of 편집 상태 swaps the
  // row's element for the editing one, which would drop a pointer capture.
  const unlisten = useRef<(() => void) | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    setOpen(null);
    if (!editing) setPicked(null);
  }, [editing]);
  useEffect(() => () => endPress(), []);

  // Once a row is lifted the finger drags it, not the list: stop the
  // browser from taking the touch for a scroll (which would cancel it).
  // While only held, the list can still scroll (moving cancels the hold).
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const stop = (event: TouchEvent) => {
      if (dragRef.current) event.preventDefault();
    };
    list.addEventListener('touchmove', stop, { passive: false });
    return () => list.removeEventListener('touchmove', stop);
  }, []);

  const rows = orderedCategories(categories);
  const indexOf = (id: string) => rows.findIndex((c) => c.id === id);
  const latest = useRef({ rows, indexOf, onDrop });
  latest.current = { rows, indexOf, onDrop };

  const endPress = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
    unlisten.current?.();
    unlisten.current = null;
  };

  const lift = (id: string, y: number, li: HTMLElement | null) => {
    hold.current = null;
    setDrag({ id, startY: y, dy: 0, to: latest.current.indexOf(id), rowH: li?.offsetHeight ?? 52 });
  };

  const onPressMove = (event: globalThis.PointerEvent) => {
    const h = hold.current;
    if (h && Math.hypot(event.clientX - h.x, event.clientY - h.y) > HOLD_SLOP) return endPress();
    const d = dragRef.current;
    if (!d) return;
    const { rows: list, indexOf: at } = latest.current;
    const dy = event.clientY - d.startY;
    setDrag({ ...d, dy, to: Math.max(0, Math.min(list.length - 1, at(d.id) + Math.round(dy / d.rowH))) });
  };

  const onPressUp = () => {
    endPress();
    const d = dragRef.current;
    if (!d) return;
    const { indexOf: at, onDrop: drop } = latest.current;
    if (d.to !== at(d.id)) drop(d.id, d.to);
    setDrag(null);
  };

  const onPressCancel = () => {
    endPress();
    setDrag(null);
  };

  const listen = () => {
    unlisten.current?.();
    window.addEventListener('pointermove', onPressMove);
    window.addEventListener('pointerup', onPressUp);
    window.addEventListener('pointercancel', onPressCancel);
    unlisten.current = () => {
      window.removeEventListener('pointermove', onPressMove);
      window.removeEventListener('pointerup', onPressUp);
      window.removeEventListener('pointercancel', onPressCancel);
    };
  };

  // The handle lifts the row at once.
  const onHandleDown = (event: PointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    endPress();
    setPicked(null);
    listen();
    lift(id, event.clientY, event.currentTarget.closest('li'));
  };

  // Anywhere else on a row, a hold lifts it (moving sooner scrolls the list).
  // Out of 편집 상태 the hold also turns 편집 상태 on, that row picked and
  // still under the finger, so it can be dragged straight away.
  const onRowDown = (event: PointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0) return;
    endPress();
    setPicked(null);
    const li = event.currentTarget.closest('li');
    const timer = window.setTimeout(() => {
      const h = hold.current;
      if (!h) return;
      if (!editing) {
        onStartEditing();
        setPicked(id);
      }
      lift(id, h.y, h.li);
    }, HOLD_MS);
    hold.current = { timer, id, x: event.clientX, y: event.clientY, li };
    listen();
  };

  // Rows the dragged one passes step aside; it follows the finger.
  const shift = (i: number): number => {
    if (!drag) return 0;
    const from = indexOf(drag.id);
    if (i === from) return drag.dy;
    if (from < i && i <= drag.to) return -drag.rowH;
    if (drag.to <= i && i < from) return drag.rowH;
    return 0;
  };

  const pinsIn = (categoryId: string) =>
    pins
      .filter((p) => (isUncategorized(categories, p.categoryId) ? UNCATEGORIZED.id : p.categoryId) === categoryId)
      .sort((a, b) => a.place.name.localeCompare(b.place.name, 'ko'));

  const pinList = (categoryId: string) => {
    const list = pinsIn(categoryId);
    return (
      <ul className="cat-item__pins" aria-label="이 카테고리의 핀">
        {list.length === 0 && <li className="cat-item__empty">아직 핀이 없어요</li>}
        {list.map((pin) => (
          <li key={pin.id}>
            <button className="cat-item__pin" onClick={() => onPickPin(pin.id)}>
              {pin.place.name}
            </button>
          </li>
        ))}
      </ul>
    );
  };

  const badge = (color: PinTint, icon: Parameters<typeof PinGlyph>[0]['icon']) => (
    <span className={`pin-badge ${color === 0 ? 'pin-badge--none' : ''}`} style={{ '--pin': pinColorCss(color) } as CSSProperties} aria-hidden>
      <PinGlyph icon={icon} />
    </span>
  );

  const countLabel = (id: string) => {
    const n = pinCounts.get(id) ?? 0;
    return n > 0 ? `${n}곳` : '';
  };

  const uncategorizedOpen = open === UNCATEGORIZED.id;

  return (
    <div className="cat-manager">
      <ul ref={listRef} className={`cat-manager__list ${editing ? 'is-editing' : ''} ${drag ? 'is-sorting' : ''}`}>
        {/* 미분류 always comes first and can't be edited, moved or deleted: where pins go when their category does. */}
        <li className="cat-item cat-item--fixed">
          {editing ? (
            <div className="cat-item__head">
              <span className="cat-item__grip is-blank" aria-hidden />
              {badge(0, 'pin')}
              <span className="cat-item__name">{UNCATEGORIZED.name}</span>
            </div>
          ) : (
            <button
              className="cat-item__head"
              aria-expanded={uncategorizedOpen}
              onClick={() => setOpen(uncategorizedOpen ? null : UNCATEGORIZED.id)}
            >
              {badge(0, 'pin')}
              <span className="cat-item__name">{UNCATEGORIZED.name}</span>
              <span className="cat-item__count">{countLabel(UNCATEGORIZED.id)}</span>
            </button>
          )}
          {uncategorizedOpen && pinList(UNCATEGORIZED.id)}
        </li>
        {rows.map((category, i) => {
          const style = categoryStyle(categories, category.id);
          const expanded = open === category.id;
          const lifted = drag?.id === category.id;
          const offset = shift(i);
          return (
            <li
              key={category.id}
              className={`cat-item ${lifted ? 'is-dragged' : ''} ${picked === category.id ? 'is-picked' : ''}`}
              style={offset ? { transform: `translateY(${offset}px)` } : undefined}
            >
              {editing ? (
                <div
                  className="cat-item__head"
                  onPointerDown={(e) => onRowDown(e, category.id)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {/* Far left: the drag handle (the row can be dragged). */}
                  <span
                    className="cat-item__grip"
                    role="button"
                    tabIndex={0}
                    aria-label={`${category.name} 순서 옮기기`}
                    onPointerDown={(e) => onHandleDown(e, category.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        onMove(category.id, e.key === 'ArrowUp' ? -1 : 1);
                      }
                    }}
                  >
                    <GripVertical size={20} aria-hidden />
                  </span>
                  {badge(style.color, style.icon)}
                  <span className="cat-item__name">{category.name}</span>
                  {/* In the count's place: ✎ (핀 카테고리 편집) and 🗑, right-aligned. Their own presses aren't the row's. */}
                  <span className="cat-item__tools" onPointerDown={(e) => e.stopPropagation()}>
                    <button className="icon-btn" aria-label={`${category.name} 편집`} onClick={() => onEditCategory(category)}>
                      <Pencil size={18} aria-hidden />
                    </button>
                    <button
                      className="icon-btn icon-btn--danger"
                      aria-label={`${category.name} 삭제`}
                      onClick={() => setDeleting(category)}
                    >
                      <Trash2 size={20} aria-hidden />
                    </button>
                  </span>
                </div>
              ) : (
                <button
                  className="cat-item__head"
                  aria-expanded={expanded}
                  onPointerDown={(e) => onRowDown(e, category.id)}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => setOpen(expanded ? null : category.id)}
                >
                  {badge(style.color, style.icon)}
                  <span className="cat-item__name">{category.name}</span>
                  <span className="cat-item__count">{countLabel(category.id)}</span>
                </button>
              )}
              {expanded && !editing && pinList(category.id)}
            </li>
          );
        })}
      </ul>
      {deleting && (
        <ConfirmDialog
          label="카테고리 삭제"
          message={`'${deleting.name}' 카테고리를 삭제합니다.`}
          detail="핀은 모두 미분류로 옮겨져요."
          onConfirm={() => onDelete(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
