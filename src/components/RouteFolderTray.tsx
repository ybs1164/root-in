import { FolderInput, Inbox, Layers, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  addFolder,
  deleteFolder,
  FOLDER_ICONS,
  folderOf,
  moveFolder,
  moveRoute,
  ROUTE_FOLDER_LIMITS,
  openRouteTab,
  placeRoute,
  routesInTab,
  setFolderIcon,
  type RouteFolders,
  type RouteTab,
} from '../domain/routeFolders';
import type { Course } from '../types/course';

interface RouteFolderTrayProps {
  /** False while it slides away (it stays mounted for that). */
  open: boolean;
  /** A route is on show: the sheet sinks to a strip so the map has the room. */
  lowered: boolean;
  courses: Course[];
  folders: RouteFolders;
  onFolders: (next: RouteFolders) => void;
  /** The route drawn on the map, if any; tapping a row shows (or hides) it. */
  shownId: string | null;
  onShow: (course: Course | null) => void;
  /** The open tab, kept by the app so it survives the sheet going down. */
  tab: RouteTab;
  onTab: (tab: RouteTab) => void;
  /** The + inside the folder: put the sheet down and make a route from pins. */
  onNewRoute: () => void;
  /** Deletes a saved route (from the open route's tools). */
  onDeleteRoute: (course: Course) => void;
}

/** The fixed tabs wear line icons, set apart from the folders' own emoji. */
const ALL_ICON = <Layers size={20} aria-hidden />;
const NONE_ICON = <Inbox size={20} aria-hidden />;

/** Hold this long on a folder tab to lift it. */
const LONG_PRESS_MS = 450;
/** Moving this far before then is a scroll of the tab row, not a press. */
const PRESS_SLOP_PX = 8;

interface Press {
  id: string;
  x: number;
  y: number;
  timer: number;
  /** Lifted: the long press has fired. */
  active: boolean;
  moved: boolean;
  /** Once lifted: the tab's resting left edge then, and the finger's latest x. */
  startLeft: number;
  lastX: number;
}

/** How long tabs take to slide into new places (and the dragged one to settle). */
const SLIDE_MS = 180;

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * 경로 폴더: a white sheet rising in the tab buttons' place, with index
 * tabs along its top edge like a file folder's. 전체 lists every saved route,
 * 미분류 the ones not filed anywhere, then the user's own folders, and + adds
 * one. Every tab is an icon only (no names, no counts). Tapping the open
 * folder's tab again (or making a new one) pops a small icon picker up above
 * that tab, like a ping's shape picker on TODAY. Long-pressing a folder tab
 * lifts it so it can be dragged among the folders; let go without moving and
 * an ✕ appears on it, which deletes the folder after a confirm.
 */
export default function RouteFolderTray({ open, lowered, courses, folders, onFolders, shownId, onShow, tab, onTab: setTab, onNewRoute, onDeleteRoute }: RouteFolderTrayProps) {
  // The folder whose icon picker is out.
  const [picking, setPicking] = useState<string | null>(null);
  // The route whose 폴더 chooser is out.
  const [filing, setFiling] = useState<string | null>(null);
  const tabsEl = useRef<HTMLDivElement | null>(null);
  // Long press: the tab being held / dragged, the one showing its ✕, and the
  // one waiting on the delete confirm.
  const press = useRef<Press | null>(null);
  const swallowClick = useRef(false);
  const [lifted, setLifted] = useState<string | null>(null);
  // Folder order while one is dragged. Shown with CSS `order` and saved on
  // release: re-ordering the DOM mid-drag would drop the pointer capture.
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const dragOrderRef = useRef<string[] | null>(null);
  dragOrderRef.current = dragOrder;
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const confirmEl = useRef<HTMLDialogElement | null>(null);
  const foldersRef = useRef(folders);
  foldersRef.current = folders;

  // A deleted-elsewhere folder can't stay selected.
  const current = openRouteTab(folders, tab);
  const routes = routesInTab(courses, folders, current);

  const add = () => {
    const id = newId();
    const next = addFolder(folders, id);
    if (!next) return;
    onFolders(next);
    setTab(id);
    setPicking(id);
  };

  // Where the picker points: the picked tab's centre, across the sheet. A new
  // tab sits at the end next to +, so it is scrolled into view first.
  const sheetEl = useRef<HTMLElement | null>(null);
  const [pickerX, setPickerX] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!picking) return setPickerX(null);
    const tabEl = tabsEl.current?.querySelector<HTMLElement>(`[data-tab="${picking}"]`);
    tabEl?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    const tab = tabEl?.getBoundingClientRect();
    const sheet = sheetEl.current?.getBoundingClientRect();
    setPickerX(tab && sheet ? tab.left + tab.width / 2 - sheet.left : null);
  }, [picking]);

  // A route just put on show: bring its row to the top of the list, which is
  // what stays in view while the sheet is lowered.
  useEffect(() => {
    if (!shownId) return;
    const row = sheetEl.current?.querySelector<HTMLElement>('.route-row.is-shown');
    const body = row?.closest<HTMLElement>('.route-folders__body');
    // The route becomes the first thing in view (the + row scrolls away above it).
    if (row && body) body.scrollTo({ top: row.offsetTop - body.offsetTop - 6, behavior: 'smooth' });
  }, [shownId]);

  // A touch anywhere but the picker closes it. Listened for on the document:
  // the sheet's slide-in keeps a fixed backdrop from covering the screen.
  // The folder's own tab is left to its click, which toggles the picker.
  useEffect(() => {
    if (!picking) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest('.folder-picker') || t?.closest(`[data-tab="${picking}"]`)) return;
      setPicking(null);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [picking]);

  // While a tab is lifted, a finger sliding along the row drags it instead of
  // scrolling the row (React's touch listeners are passive, so this one isn't).
  useEffect(() => {
    const row = tabsEl.current;
    if (!row) return;
    const hold = (e: TouchEvent) => {
      if (press.current?.active) e.preventDefault();
    };
    row.addEventListener('touchmove', hold, { passive: false });
    return () => row.removeEventListener('touchmove', hold);
  }, []);

  // The ✕ goes away on a touch anywhere else.
  useEffect(() => {
    if (!deleting) return;
    const away = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest('.route-folders__x')) return;
      setDeleting(null);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [deleting]);

  // The confirm is a native modal <dialog>: the top layer escapes the sheet's
  // slide-in transform, and Esc / focus handling come with it.
  useEffect(() => {
    const dialog = confirmEl.current;
    if (confirming && dialog && !dialog.open) dialog.showModal();
  }, [confirming]);

  // ----- Drag animation -----
  // Positions are offsetLeft (layout, untouched by transforms), all in the
  // same offset parent. The dragged tab follows the finger with a transform;
  // the others glide to their new places (FLIP) when the order changes.
  const wrapOf = (id: string) => tabsEl.current?.querySelector<HTMLElement>(`[data-folder="${id}"]`) ?? null;
  const restingLefts = useRef(new Map<string, number>());

  const followFinger = () => {
    const p = press.current;
    const el = p?.active ? wrapOf(p.id) : null;
    if (!p || !el) return;
    el.style.transition = 'none';
    el.style.zIndex = '2';
    el.style.transform = `translateX(${p.startLeft + (p.lastX - p.x) - el.offsetLeft}px)`;
  };

  useLayoutEffect(() => {
    const els = [...(tabsEl.current?.querySelectorAll<HTMLElement>('[data-folder]') ?? [])];
    for (const el of els) {
      const id = el.dataset.folder!;
      const before = restingLefts.current.get(id);
      const now = el.offsetLeft;
      restingLefts.current.set(id, now);
      if (id === press.current?.id || before === undefined || before === now) continue;
      // Start where it was, then let it slide home.
      el.style.transition = 'none';
      el.style.transform = `translateX(${before - now}px)`;
      void el.offsetWidth;
      el.style.transition = `transform ${SLIDE_MS}ms ease`;
      el.style.transform = '';
    }
    followFinger();
  });

  const endPress = () => {
    const p = press.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    if (!p.active) {
      press.current = null;
      return;
    }
    // The click that follows a long press shouldn't also select / pick.
    swallowClick.current = true;
    setLifted(null);
    const el = wrapOf(p.id);
    press.current = null;
    // The dragged tab settles into its slot…
    if (el) {
      el.style.transition = `transform ${SLIDE_MS}ms ease`;
      el.style.transform = '';
    }
    if (!p.moved) {
      setDragOrder(null);
      if (el) el.style.zIndex = '';
      return setDeleting(p.id);
    }
    // …and only then is the new order saved (moving DOM nodes mid-slide would cut it short).
    const order = dragOrderRef.current;
    window.setTimeout(() => {
      if (el) el.style.zIndex = '';
      setDragOrder(null);
      if (order) onFolders(moveFolder(foldersRef.current, p.id, order.indexOf(p.id)));
    }, SLIDE_MS);
  };

  /** Long press → lift; then drag to reorder, or let go in place for the ✕. */
  const pressHandlers = (id: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      // Keep getting this pointer's moves once it leaves the tab (touch does
      // this by itself; a mouse doesn't).
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const p: Press = { id, x: e.clientX, y: e.clientY, timer: 0, active: false, moved: false, startLeft: 0, lastX: e.clientX };
      p.timer = window.setTimeout(() => {
        p.active = true;
        p.startLeft = wrapOf(id)?.offsetLeft ?? 0;
        setLifted(id);
        setDragOrder(foldersRef.current.folders.map((f) => f.id));
        setDeleting(null);
        setPicking(null);
        navigator.vibrate?.(10);
      }, LONG_PRESS_MS);
      press.current = p;
    },
    onPointerMove: (e: React.PointerEvent) => {
      const p = press.current;
      if (!p) return;
      const dx = e.clientX - p.x;
      if (!p.active) {
        if (Math.hypot(dx, e.clientY - p.y) > PRESS_SLOP_PX) {
          window.clearTimeout(p.timer);
          press.current = null;
        }
        return;
      }
      if (Math.abs(dx) > PRESS_SLOP_PX) p.moved = true;
      p.lastX = e.clientX;
      followFinger();
      // Its new slot: how many of the other folder tabs rest left of the
      // dragged tab's centre (resting places, not mid-slide ones).
      const self = wrapOf(id);
      const centre = p.startLeft + dx + (self?.offsetWidth ?? 0) / 2;
      const others = [...(tabsEl.current?.querySelectorAll<HTMLElement>('[data-folder]') ?? [])].filter((el) => el.dataset.folder !== id);
      const to = others.filter((el) => el.offsetLeft + el.offsetWidth / 2 < centre).length;
      setDragOrder((order) => {
        if (!order || order.indexOf(id) === to) return order;
        const next = order.filter((f) => f !== id);
        next.splice(to, 0, id);
        return next;
      });
    },
    onPointerUp: endPress,
    onPointerCancel: endPress,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  /** Every tab is just an icon: a line icon for the fixed two, the folder's own emoji otherwise. */
  const tabButton = (id: RouteTab, label: string, icon: ReactNode) => {
    const on = current === id;
    const custom = id !== 'all' && id !== 'none';
    const button = (
      <button
        key={id}
        data-tab={id}
        role="tab"
        aria-selected={on}
        aria-label={custom && on ? `${label}, 다시 누르면 아이콘 바꾸기` : label}
        className={`route-folders__tab ${on ? 'is-on' : ''} ${lifted === id ? 'is-lifted' : ''} ${rowDrag?.overTab === id ? 'is-drop' : ''}`}
        {...(custom ? pressHandlers(id) : {})}
        onClick={() => {
          if (swallowClick.current) {
            swallowClick.current = false;
            return;
          }
          setFiling(null);
          // Any tab lets go of a route on show (the sheet comes back up).
          if (shownId) onShow(null);
          // The second tap on an open folder brings out its icon picker and,
          // with it, the ✕ (as a long press does); the first tap only selects.
          const opening = on && custom && picking !== id;
          setDeleting(opening ? id : null);
          if (on && custom) return setPicking(opening ? id : null);
          setTab(id);
          setPicking(null);
        }}
      >
        <span className="route-folders__icon" aria-hidden>
          {icon}
        </span>
      </button>
    );
    if (!custom) return button;
    // A folder tab sits in a wrapper so its ✕ can be a sibling button.
    return (
      <div
        key={id}
        className="route-folders__tabwrap"
        data-folder={id}
        style={dragOrder ? { order: 2 + dragOrder.indexOf(id) } : undefined}
      >
        {button}
        {deleting === id && (
          <button className="route-folders__x" aria-label={`${label} 삭제`} onClick={() => setConfirming(id)}>
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
    );
  };

  // ----- Dragging a route (long press on its row) -----
  // The lifted row is drawn as a copy floating over the sheet (the list
  // scrolls inside a clipping box, and the row must reach the tabs); its own
  // place stays open while the others slide out of the way. Let go over a
  // folder tab to file it there, or among the rows to put it in that place.
  const bodyEl = useRef<HTMLDivElement | null>(null);
  const rowPress = useRef<{ id: string; x: number; y: number; timer: number } | null>(null);
  const [rowDrag, setRowDrag] = useState<{
    id: string;
    from: number;
    to: number;
    dx: number;
    dy: number;
    /** Resting rows (top and height), measured when it was lifted. */
    rows: { top: number; height: number }[];
    /** Where the lifted row sat, relative to the sheet. */
    box: { left: number; top: number; width: number; height: number };
    /** The tab under the finger it would be filed into, if any. */
    overTab: RouteTab | null;
    /** Off the sheet altogether (over the map): letting go there changes nothing. */
    away: boolean;
  } | null>(null);
  const rowDragRef = useRef(rowDrag);
  rowDragRef.current = rowDrag;

  // While a row is lifted, finger moves drag it instead of scrolling the list.
  useEffect(() => {
    const body = bodyEl.current;
    if (!body) return;
    const hold = (e: TouchEvent) => {
      if (rowDragRef.current) e.preventDefault();
    };
    body.addEventListener('touchmove', hold, { passive: false });
    return () => body.removeEventListener('touchmove', hold);
  }, []);

  /** A tab a lifted route can be filed into at a screen point: 미분류 or a folder, not the one open. */
  const dropTabAt = (x: number, y: number): RouteTab | null => {
    const tabEl = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-tab]');
    const id = tabEl?.dataset.tab;
    return id && id !== 'all' && id !== current ? id : null;
  };

  const rowHandlers = (c: Course, index: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || !e.isPrimary) return;
      const el = e.currentTarget;
      const pointerId = e.pointerId;
      const p = { id: c.id, x: e.clientX, y: e.clientY, timer: 0 };
      p.timer = window.setTimeout(() => {
        const sheet = sheetEl.current?.getBoundingClientRect();
        const rowEls = [...(bodyEl.current?.querySelectorAll<HTMLElement>('.route-row') ?? [])];
        const row = rowEls[index]?.getBoundingClientRect();
        if (!sheet || !row) return;
        el.setPointerCapture?.(pointerId);
        setFiling(null);
        setRowDrag({
          id: c.id,
          from: index,
          to: index,
          dx: 0,
          dy: 0,
          rows: rowEls.map((r) => {
            const b = r.getBoundingClientRect();
            return { top: b.top, height: b.height };
          }),
          box: { left: row.left - sheet.left, top: row.top - sheet.top, width: row.width, height: row.height },
          overTab: null,
          away: false,
        });
        navigator.vibrate?.(10);
      }, LONG_PRESS_MS);
      rowPress.current = p;
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const p = rowPress.current;
      if (!p) return;
      const d = rowDragRef.current;
      if (!d) {
        // Moving first is scrolling the list, not a press.
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > PRESS_SLOP_PX) {
          window.clearTimeout(p.timer);
          rowPress.current = null;
        }
        return;
      }
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      const overTab = dropTabAt(e.clientX, e.clientY);
      // Its new place: how many of the other rows' middles lie above its middle.
      const mid = d.rows[d.from].top + dy + d.rows[d.from].height / 2;
      const to = overTab ? d.from : d.rows.filter((r, i) => i !== d.from && r.top + r.height / 2 < mid).length;
      const sheet = sheetEl.current?.getBoundingClientRect();
      const away = !!sheet && !overTab && (e.clientY < sheet.top || e.clientY > sheet.bottom || e.clientX < sheet.left || e.clientX > sheet.right);
      setRowDrag({ ...d, dx, dy, to: away ? d.from : to, overTab, away });
    },
    onPointerUp: () => endRowPress(true),
    onPointerCancel: () => endRowPress(false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const endRowPress = (drop: boolean) => {
    const p = rowPress.current;
    if (p) window.clearTimeout(p.timer);
    rowPress.current = null;
    const d = rowDragRef.current;
    if (!d) return;
    // Heard by both the row and the document: only the first one counts.
    rowDragRef.current = null;
    setRowDrag(null);
    // The click that ends a long press shouldn't also show / hide the route.
    // Only the click straight after the release; a tap after that is a tap.
    swallowRowClick.current = true;
    window.setTimeout(() => (swallowRowClick.current = false), 250);
    if (!drop || d.away) return;
    if (d.overTab) onFolders(moveRoute(folders, d.id, d.overTab === 'none' ? null : d.overTab));
    else if (d.to !== d.from) onFolders(placeRoute(courses, folders, current, d.id, d.to));
  };
  const swallowRowClick = useRef(false);
  const endRowPressRef = useRef(endRowPress);
  endRowPressRef.current = endRowPress;

  // Letting go always ends a lift, wherever the finger is: the row's own
  // handlers only hear the release if its pointer capture took, and a lift
  // left hanging would keep the row floating. Also before the lift fires
  // (a press let go early just stops waiting).
  const lifting = !!rowDrag;
  useEffect(() => {
    if (!lifting) return;
    const drop = () => endRowPressRef.current(true);
    const cancel = () => endRowPressRef.current(false);
    document.addEventListener('pointerup', drop, true);
    document.addEventListener('touchend', drop, true);
    document.addEventListener('pointercancel', cancel, true);
    document.addEventListener('touchcancel', cancel, true);
    return () => {
      document.removeEventListener('pointerup', drop, true);
      document.removeEventListener('touchend', drop, true);
      document.removeEventListener('pointercancel', cancel, true);
      document.removeEventListener('touchcancel', cancel, true);
    };
  }, [lifting]);

  /** Where a resting row sits while another is dragged: shifted a row's height to make room. */
  const rowShift = (i: number) => {
    const d = rowDrag;
    if (!d || i === d.from) return 0;
    const h = d.rows[d.from].height;
    if (d.from < i && i <= d.to) return -h;
    if (d.to <= i && i < d.from) return h;
    return 0;
  };
  const draggedRoute = rowDrag ? courses.find((c) => c.id === rowDrag.id) : null;

  const pickingFolder = folders.folders.find((f) => f.id === picking) ?? null;

  return (
    <section
      ref={sheetEl}
      className={`route-folders ${open ? '' : 'is-leaving'} ${lowered ? 'is-lowered' : ''} ${lowered && courses.find((c) => c.id === shownId)?.note ? 'has-note' : ''}`} aria-label="경로 폴더" inert={!open}>
      {pickingFolder && pickerX !== null && (
        <>
          <div className="folder-picker" role="dialog" aria-label="폴더 아이콘" style={{ '--x': `${pickerX}px` } as CSSProperties}>
            {FOLDER_ICONS.map((icon) => (
              <button
                key={icon}
                className={`folder-picker__opt ${pickingFolder.icon === icon ? 'is-on' : ''}`}
                aria-pressed={pickingFolder.icon === icon}
                onClick={() => {
                  onFolders(setFolderIcon(folders, pickingFolder.id, icon));
                  setPicking(null);
                }}
              >
                {icon}
              </button>
            ))}
          </div>
        </>
      )}
      <dialog
        ref={confirmEl}
        className="confirm-dialog"
        aria-label="폴더 삭제"
        onClose={() => {
          setConfirming(null);
          setDeleting(null);
        }}
      >
        <p>
          폴더를 삭제합니다.
          <br />
          이 작업은 되돌릴 수 없습니다.
        </p>
        <div className="confirm-dialog__actions">
          <button className="btn btn--ghost" onClick={() => confirmEl.current?.close()}>
            취소
          </button>
          <button
            className="btn btn--danger"
            onClick={() => {
              if (confirming) onFolders(deleteFolder(folders, confirming));
              confirmEl.current?.close();
            }}
          >
            확인
          </button>
        </div>
      </dialog>

      <div ref={tabsEl} className="route-folders__tabs" role="tablist" aria-label="폴더">
        {tabButton('all', '전체', ALL_ICON)}
        {tabButton('none', '미분류', NONE_ICON)}
        {folders.folders.map((f) => tabButton(f.id, f.name, f.icon))}
        <button
          className="route-folders__tab route-folders__tab--add"
          aria-label="새 폴더"
          disabled={folders.folders.length >= ROUTE_FOLDER_LIMITS.maxFolders}
          onClick={add}
        >
          <Plus size={18} aria-hidden />
        </button>
      </div>

      {rowDrag && draggedRoute && (
        // The lifted route, following the finger over the list and the tabs.
        <div
          className={`route-row route-row--ghost ${rowDrag.overTab ? 'is-over-tab' : ''}`}
          style={{
            left: rowDrag.box.left,
            top: rowDrag.box.top,
            width: rowDrag.box.width,
            height: rowDrag.box.height,
            transform: `translate(${rowDrag.dx}px, ${rowDrag.dy}px)`,
          }}
          aria-hidden
        >
          <div className="route-row__main">
            {draggedRoute.icon && <span className="route-row__icon">{draggedRoute.icon}</span>}
            <strong>{draggedRoute.title || '이름 없는 경로'}</strong>
          </div>
        </div>
      )}

      <div
        ref={bodyEl}
        className={`route-folders__body ${rowDrag ? 'is-sorting' : ''}`}
        role="tabpanel"
        onClick={(e) => {
          // A tap on the sheet's empty space (not a row or a button) lets go of a route on show.
          if (shownId && !(e.target as Element).closest('button, a, input')) onShow(null);
        }}
      >
        <button className="route-folders__new" aria-label="새 경로 만들기" onClick={onNewRoute}>
          <Plus size={20} aria-hidden />
        </button>
        {routes.length === 0 ? (
          // An empty folder of the user's own just stays blank.
          (current === 'all' || current === 'none') && (
            <p className="route-folders__empty">
              {courses.length === 0 ? '저장한 경로가 없어요. 오른쪽 위 + 로 핀을 이어 만들어 보세요.' : '여기에 있는 경로가 없어요.'}
            </p>
          )
        ) : (
          <ul className="route-folders__list">
            {routes.map((c, index) => {
              const filed = folderOf(folders, c.id);
              const shown = shownId === c.id;
              return (
                <li
                  key={c.id}
                  className={`route-row ${shown ? 'is-shown' : ''} ${rowDrag?.id === c.id ? 'is-lifted' : ''}`}
                  style={rowShift(index) ? { transform: `translateY(${rowShift(index)}px)` } : undefined}
                >
                  <button
                    className="route-row__main"
                    aria-pressed={shown}
                    {...rowHandlers(c, index)}
                    onClick={() => {
                      if (swallowRowClick.current) {
                        swallowRowClick.current = false;
                        return;
                      }
                      onShow(shown ? null : c);
                    }}
                  >
                    {c.icon && (
                      <span className="route-row__icon" aria-hidden>
                        {c.icon}
                      </span>
                    )}
                    <strong>{c.title || '이름 없는 경로'}</strong>
                    {/* Its folder, at the right end of its line; a route in none shows nothing. */}
                    {filed && (
                      <span className="route-row__folder" aria-label={`${folders.folders.find((f) => f.id === filed)?.name ?? '폴더'}에 있음`}>
                        {folders.folders.find((f) => f.id === filed)?.icon ?? '📁'}
                      </span>
                    )}
                  </button>
                  {/* The open route's description, small and grey under its name. */}
                  {shown && c.note && <p className={`route-row__note ${c.icon ? 'has-icon' : ''}`}>{c.note}</p>}
                  {/* The open route's tools: small, at its bottom right. */}
                  {shown && (
                    <div className="route-row__tools">
                      <button
                        className="route-row__tool"
                        aria-label={`${c.title || '경로'} 폴더 옮기기`}
                        aria-expanded={filing === c.id}
                        onClick={() => setFiling(filing === c.id ? null : c.id)}
                      >
                        <FolderInput size={18} aria-hidden />
                      </button>
                      <button className="route-row__tool route-row__tool--danger" aria-label={`${c.title || '경로'} 삭제`} onClick={() => onDeleteRoute(c)}>
                        <Trash2 size={18} aria-hidden />
                      </button>
                    </div>
                  )}
                  {shown && filing === c.id && (
                    <div className="route-row__chooser" role="group" aria-label="옮길 폴더">
                      {[{ id: null, name: '미분류', icon: NONE_ICON }, ...folders.folders].map((f) => (
                        <button
                          key={f.id ?? 'none'}
                          className={`route-row__to ${filed === f.id ? 'is-on' : ''}`}
                          aria-label={f.name}
                          aria-pressed={filed === f.id}
                          onClick={() => {
                            onFolders(moveRoute(folders, c.id, f.id));
                            setFiling(null);
                          }}
                        >
                          {f.icon}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
