import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { categoryStyle, isUncategorized, orderedCategories, placeCategory, UNCATEGORIZED } from '../domain/pin';
import type { Pin, PinCategory } from '../types/pin';
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
  /** A row dragged to `to` among its siblings. */
  onDrop: (id: string, to: number) => void;
  onDelete: (id: string) => void;
  /** A pin picked from a category's list: as if it were tapped on the map. */
  onPickPin: (id: string) => void;
}

/** Hold this long without moving to lift a row (moving sooner scrolls the list). */
const HOLD_MS = 450;
const HOLD_SLOP = 8;

interface Drag {
  id: string;
  startY: number;
  dy: number;
  /** Where it would land among its siblings. */
  to: number;
  rowH: number;
}

/**
 * 핀 카테고리 (CategorySheet). Out of 편집 상태 a row opens the names of
 * its pins (tap one to see it on the map); in it, a row shows a drag handle
 * on its left and ✎ 🗑 where its count was; ✎ edits it, and the handle (or a
 * long press anywhere on the row) lifts it to drag.
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
}: CategoryManagerProps) {
  const [open, setOpen] = useState<string | null>(null);
  // The category whose bin was tapped, waiting on the confirm.
  const [deleting, setDeleting] = useState<PinCategory | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const hold = useRef<{ timer: number; id: string; x: number; y: number; el: HTMLElement; pointerId: number } | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => setOpen(null), [editing]);
  useEffect(() => () => cancelHold(), []);

  // Once a row is lifted the finger drags it, not the list: stop the
  // browser from taking the touch for a scroll (which would cancel it).
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const stop = (event: TouchEvent) => {
      if (dragRef.current || hold.current) event.preventDefault();
    };
    list.addEventListener('touchmove', stop, { passive: false });
    return () => list.removeEventListener('touchmove', stop);
  }, []);

  const rows = orderedCategories(categories);
  const oldIndex = new Map(rows.map(({ category }, i) => [category.id, i]));

  // Where every row sits if the dragged one landed at `to`.
  const layoutAt = (id: string, to: number) =>
    new Map(orderedCategories(placeCategory(categories, id, to)).map(({ category }, i) => [category.id, i]));

  const siblingCount = (id: string) => {
    const target = categories.find((c) => c.id === id);
    return categories.filter((c) => c.parentId === target?.parentId).length;
  };

  // The spot whose layout puts the dragged row nearest the finger.
  const nearestSpot = (id: string, dy: number, rowH: number) => {
    let best = 0;
    let bestGap = Infinity;
    for (let to = 0; to < siblingCount(id); to++) {
      const gap = Math.abs(((layoutAt(id, to).get(id) ?? 0) - (oldIndex.get(id) ?? 0)) * rowH - dy);
      if (gap < bestGap) [best, bestGap] = [to, gap];
    }
    return best;
  };

  const startSpot = (id: string) => {
    const target = categories.find((c) => c.id === id);
    return orderedCategories(categories)
      .filter(({ category }) => category.parentId === target?.parentId)
      .findIndex(({ category }) => category.id === id);
  };

  const cancelHold = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
  };

  const lift = (el: HTMLElement, pointerId: number, id: string, y: number) => {
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // The pointer may already be gone; the drag then ends on the next up.
    }
    setDrag({ id, startY: y, dy: 0, to: startSpot(id), rowH: el.closest('li')?.offsetHeight ?? 52 });
  };

  // The handle lifts the row at once; anywhere else on the row needs a hold
  // (moving sooner scrolls the list).
  const onHandleDown = (event: PointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    cancelHold();
    lift(event.currentTarget.closest<HTMLElement>('.cat-item__head') ?? event.currentTarget, event.pointerId, id, event.clientY);
  };

  const onRowDown = (event: PointerEvent<HTMLElement>, id: string) => {
    if (!editing || event.button !== 0) return;
    cancelHold();
    const el = event.currentTarget;
    const pointerId = event.pointerId;
    const timer = window.setTimeout(() => {
      const h = hold.current;
      hold.current = null;
      if (h) lift(el, pointerId, id, h.y);
    }, HOLD_MS);
    hold.current = { timer, id, x: event.clientX, y: event.clientY, el, pointerId };
  };

  const onRowMove = (event: PointerEvent<HTMLElement>) => {
    const h = hold.current;
    if (h && Math.hypot(event.clientX - h.x, event.clientY - h.y) > HOLD_SLOP) cancelHold();
    const d = dragRef.current;
    if (!d) return;
    const dy = event.clientY - d.startY;
    setDrag({ ...d, dy, to: nearestSpot(d.id, dy, d.rowH) });
  };

  const onRowUp = () => {
    cancelHold();
    const d = dragRef.current;
    if (!d) return;
    if (d.to !== startSpot(d.id)) onDrop(d.id, d.to);
    setDrag(null);
  };

  // Rows the dragged one passes step aside; it (and its sub-categories) follow the finger.
  const shift = (category: PinCategory): number => {
    if (!drag) return 0;
    if (category.id === drag.id || category.parentId === drag.id) return drag.dy;
    const next = layoutAt(drag.id, drag.to).get(category.id) ?? 0;
    return (next - (oldIndex.get(category.id) ?? 0)) * drag.rowH;
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

  const badge = (color: string, icon: Parameters<typeof PinGlyph>[0]['icon']) => (
    <span className="pin-badge" style={{ '--pin': `var(--pin-${color})` } as CSSProperties} aria-hidden>
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
              {badge('0', 'pin')}
              <span className="cat-item__name">{UNCATEGORIZED.name}</span>
            </div>
          ) : (
            <button
              className="cat-item__head"
              aria-expanded={uncategorizedOpen}
              onClick={() => setOpen(uncategorizedOpen ? null : UNCATEGORIZED.id)}
            >
              {badge('0', 'pin')}
              <span className="cat-item__name">{UNCATEGORIZED.name}</span>
              <span className="cat-item__count">{countLabel(UNCATEGORIZED.id)}</span>
            </button>
          )}
          {uncategorizedOpen && pinList(UNCATEGORIZED.id)}
        </li>
        {rows.map(({ category, depth }) => {
          const style = categoryStyle(categories, category.id);
          const expanded = open === category.id;
          const lifted = drag && (drag.id === category.id || category.parentId === drag.id);
          const offset = shift(category);
          return (
            <li
              key={category.id}
              className={`cat-item ${depth ? 'cat-item--sub' : ''} ${lifted ? 'is-dragged' : ''}`}
              style={offset ? { transform: `translateY(${offset}px)` } : undefined}
            >
              {editing ? (
                <div
                  className="cat-item__head"
                  onPointerDown={(e) => onRowDown(e, category.id)}
                  onPointerMove={onRowMove}
                  onPointerUp={onRowUp}
                  onPointerCancel={() => {
                    cancelHold();
                    setDrag(null);
                  }}
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
                  {badge(String(style.color), style.icon)}
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
                <button className="cat-item__head" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : category.id)}>
                  {badge(String(style.color), style.icon)}
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
          detail={deleting.parentId ? '이 카테고리의 핀은 미분류로 옮겨져요.' : '핀은 모두 미분류로 옮겨져요.'}
          onConfirm={() => onDelete(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
