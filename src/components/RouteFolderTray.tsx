import { Check, FolderInput, Inbox, Layers, ListChecks, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  addFolder,
  deleteFolder,
  folderOf,
  moveFolder,
  moveRoute,
  ROUTE_FOLDER_LIMITS,
  openRouteTab,
  gatherPlace,
  placeRoutes,
  routesInTab,
  renameFolder,
  type RouteFolders,
  type RouteTab,
} from '../domain/routeFolders';
import type { Course } from '../types/course';
import ConfirmDialog from './ConfirmDialog';

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
  /** Deletes saved routes (the open route's tools, or 다중 선택's trash). */
  onDeleteRoutes: (courses: Course[]) => void;
}

/** The fixed tabs retain line icons; custom folders display their names. */
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
 * one. Custom tabs show their names. Tapping the open
 * folder's tab again (or making a new one) pops a name input up above
 * that tab, like a ping's shape picker on TODAY. Long-pressing a folder tab
 * lifts it so it can be dragged among the folders; let go without moving and
 * an ✕ appears on it, which deletes the folder after a confirm.
 */
export default function RouteFolderTray({ open, lowered, courses, folders, onFolders, shownId, onShow, tab, onTab: setTab, onNewRoute, onDeleteRoutes }: RouteFolderTrayProps) {
  // The folder whose name editor is open.
  const [picking, setPicking] = useState<string | null>(null);
  const [folderDraft, setFolderDraft] = useState('');
  // The route whose 폴더 chooser is out.
  // A route about to be deleted from its row's trash (asked first), and
  // 다중 선택's folder chooser by its trash.
  const [deletingRoute, setDeletingRoute] = useState<Course | null>(null);
  const [movingPicked, setMovingPicked] = useState(false);
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
    setFolderDraft(next.folders.find((f) => f.id === id)!.name);
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
    // The route becomes the first thing in view, under the toolbar.
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
      onFolders(renameFolder(folders, picking, folderDraft));
      setPicking(null);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [picking, folderDraft, folders, onFolders]);

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

  /** Fixed tabs show icons; custom tabs show editable folder names. */
  const tabButton = (id: RouteTab, label: string, icon: ReactNode) => {
    const on = current === id;
    const custom = id !== 'all' && id !== 'none';
    const button = (
      <button
        key={id}
        data-tab={id}
        role="tab"
        aria-selected={on}
        aria-label={custom && on ? `${label}, 다시 누르면 이름 바꾸기` : label}
        className={`route-folders__tab ${on ? 'is-on' : ''} ${lifted === id ? 'is-lifted' : ''} ${rowDrag?.overTab === id ? 'is-drop' : ''}`}
        {...(custom ? pressHandlers(id) : {})}
        onClick={() => {
          if (swallowClick.current) {
            swallowClick.current = false;
            return;
          }
          setMovingPicked(false);
          // Any tab lets go of a route on show (the sheet comes back up).
          if (shownId) onShow(null);
          // The second tap on an open folder brings out its name editor and,
          // with it, the ✕ (as a long press does); the first tap only selects.
          const opening = on && custom && picking !== id;
          setDeleting(opening ? id : null);
          if (picking) onFolders(renameFolder(folders, picking, folderDraft));
          if (on && custom) {
            if (opening) setFolderDraft(label);
            return setPicking(opening ? id : null);
          }
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
    /** The routes carried, in list order: the one held, or every picked one (다중 선택). */
    ids: string[];
    /** The row held. */
    held: string;
    heldIndex: number;
    /** Where the block would land among the other routes (0 = top). */
    to: number;
    dx: number;
    dy: number;
    /** Resting rows (top and height), measured when it was lifted. */
    rows: { top: number; height: number }[];
    /** Where the held row sat, relative to the sheet. */
    box: { left: number; top: number; width: number; height: number };
    /** The tab under the finger it would be filed into, if any. */
    overTab: RouteTab | null;
    /** Over the 다중 선택 trash: letting go deletes. */
    overTrash: boolean;
    /** Off the sheet altogether (over the map): letting go there changes nothing. */
    away: boolean;
    /** 다중 선택 as it was before the press: an action taken with the lift puts it back. */
    before: { selecting: boolean; selected: Set<string> };
  } | null>(null);
  const rowDragRef = useRef(rowDrag);
  rowDragRef.current = rowDrag;

  // ----- 다중 선택 -----
  // The ✓ beside + (or a long press on a route) turns rows into checkboxes: taps pick and unpick, the
  // trash at the sheet's bottom right deletes what's picked, and a long press
  // carries every picked route at once (onto a folder tab, the trash, or a
  // place in the list — let go in place and they gather round the one held).
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pickedRoutes = routes.filter((c) => selected.has(c.id));
  useEffect(() => setSelected(new Set()), [current]);
  const toggleSelecting = () => {
    setSelecting((on) => !on);
    setSelected(new Set());
    setMovingPicked(false);
    if (shownId) onShow(null);
  };

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
  const overTrashAt = (x: number, y: number) => !!document.elementFromPoint(x, y)?.closest('.route-folders__trash');

  /** Where the block lands: how many of the other rows' middles lie above the held row's middle. */
  const landingAt = (d: NonNullable<typeof rowDrag>, dy: number) => {
    const carried = new Set(d.ids);
    const mid = d.rows[d.heldIndex].top + dy + d.rows[d.heldIndex].height / 2;
    return routes.filter((c, i) => !carried.has(c.id) && d.rows[i] && d.rows[i].top + d.rows[i].height / 2 < mid).length;
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
        setMovingPicked(false);
        // A long press picks the route held, switching 다중 선택 on if it's
        // off; everything picked goes along.
        const next = new Set(selecting ? selected : []).add(c.id);
        setSelecting(true);
        setSelected(next);
        const ids = routes.filter((r) => next.has(r.id)).map((r) => r.id);
        setRowDrag({
          ids,
          held: c.id,
          heldIndex: index,
          // Let go without moving: the others gather round the one held.
          to: gatherPlace(courses, folders, current, ids, c.id),
          dx: 0,
          dy: 0,
          rows: rowEls.map((r) => {
            const b = r.getBoundingClientRect();
            return { top: b.top, height: b.height };
          }),
          box: { left: row.left - sheet.left, top: row.top - sheet.top, width: row.width, height: row.height },
          overTab: null,
          overTrash: false,
          away: false,
          before: { selecting, selected },
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
      const overTrash = selecting && overTrashAt(e.clientX, e.clientY);
      const sheet = sheetEl.current?.getBoundingClientRect();
      const away = !!sheet && !overTab && (e.clientY < sheet.top || e.clientY > sheet.bottom || e.clientX < sheet.left || e.clientX > sheet.right);
      // Off over a tab, the trash or the map, the rows keep the place they had.
      const to = overTab || overTrash || away ? d.to : landingAt(d, dy);
      setRowDrag({ ...d, dx, dy, to, overTab, overTrash, away });
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
    // The click that ends a long press shouldn't also show / hide (or pick) the route.
    // Only the click straight after the release; a tap after that is a tap.
    swallowRowClick.current = true;
    window.setTimeout(() => (swallowRowClick.current = false), 250);
    if (!drop || d.away) return;
    // Held and let go in place, alone: nothing happened but the pick, so it
    // stays picked (tap others to pick more).
    const moved = Math.hypot(d.dx, d.dy) > PRESS_SLOP_PX;
    if (!moved && d.ids.length === 1 && !d.overTab && !d.overTrash) return;
    if (d.overTrash) onDeleteRoutes(courses.filter((c) => d.ids.includes(c.id)));
    else if (d.overTab) {
      const to = d.overTab === 'none' ? null : d.overTab;
      onFolders(d.ids.reduce((f, id) => moveRoute(f, id, to), folders));
    } else onFolders(placeRoutes(courses, folders, current, d.ids, d.to));
    // Moved, filed or deleted: the press only carried the route, so it doesn't
    // stay picked — 다중 선택 goes back to how it was (minus anything deleted).
    setSelecting(d.before.selecting);
    setSelected(d.overTrash ? new Set([...d.before.selected].filter((id) => !d.ids.includes(id))) : d.before.selected);
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

  /**
   * Where a resting row sits while routes are carried: the rows slide to
   * where they'd be with the block in its landing place (the carried rows
   * themselves are hidden; the copy over the sheet stands in for them).
   */
  const rowShift = (i: number) => {
    const d = rowDrag;
    if (!d || !d.rows[i]) return 0;
    const carried = new Set(d.ids);
    if (carried.has(routes[i]?.id)) return 0;
    const all = routes.map((c, j) => ({ id: c.id, j }));
    const rest = all.filter((r) => !carried.has(r.id));
    const order = [...rest.slice(0, d.to), ...all.filter((r) => carried.has(r.id)), ...rest.slice(d.to)];
    let top = d.rows[0].top;
    for (const r of order) {
      if (r.j === i) return top - d.rows[i].top;
      top += d.rows[r.j]?.height ?? 0;
    }
    return 0;
  };
  const folderName = (id: string) => folders.folders.find((f) => f.id === id)?.name ?? '폴더';

  const draggedRoute = rowDrag ? courses.find((c) => c.id === rowDrag.held) : null;

  const pickingFolder = folders.folders.find((f) => f.id === picking) ?? null;

  return (
    <section
      ref={sheetEl}
      className={`route-folders ${open ? '' : 'is-leaving'} ${lowered ? 'is-lowered' : ''}`} aria-label="경로 폴더" inert={!open}>
      {pickingFolder && pickerX !== null && (
        <>
          <form className="folder-picker folder-name-editor" role="dialog" aria-label="폴더 이름 변경" style={{ '--x': `${pickerX}px` } as CSSProperties}
            onSubmit={(e) => {
              e.preventDefault();
              onFolders(renameFolder(folders, pickingFolder.id, folderDraft));
              setPicking(null);
            }}>
            <input key={pickingFolder.id} autoFocus aria-label="폴더 이름" value={folderDraft} maxLength={ROUTE_FOLDER_LIMITS.name}
              onChange={(e) => setFolderDraft(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setPicking(null); } }} />
            <button type="submit" className="icon-btn" aria-label="폴더 이름 저장"><Check size={20} aria-hidden /></button>
          </form>
        </>
      )}
      {confirming && (
        <ConfirmDialog
          label="폴더 삭제"
          message={`'${folderName(confirming)}' 폴더를 삭제합니다.`}
          detail="루트는 모두 미분류로 옮겨져요."
          onConfirm={() => onFolders(deleteFolder(folders, confirming))}
          onClose={() => {
            setConfirming(null);
            setDeleting(null);
          }}
        />
      )}

      {deletingRoute && (
        <ConfirmDialog
          label="루트 삭제"
          message={`'${deletingRoute.title || '이름 없는 경로'}' 루트를 삭제합니다.`}
          detail="삭제한 루트는 복구할 수 없어요."
          onConfirm={() => onDeleteRoutes([deletingRoute])}
          onClose={() => setDeletingRoute(null)}
        />
      )}

      <div ref={tabsEl} className="route-folders__tabs" role="tablist" aria-label="폴더">
        {tabButton('all', '전체', ALL_ICON)}
        {tabButton('none', '미분류', NONE_ICON)}
        {folders.folders.map((f) => tabButton(f.id, f.name, f.name))}
        <button
          className="route-folders__tab route-folders__tab--add"
          aria-label="새 폴더"
          disabled={folders.folders.length >= ROUTE_FOLDER_LIMITS.maxFolders}
          onClick={add}
        >
          <Plus size={18} aria-hidden />
        </button>
      </div>

      {selecting && (
        // 다중 선택: move what's picked to a folder (미분류 or one of the user's), from the chooser above.
        <div className="route-folders__move-wrap">
          <button
            className={`route-folders__move ${movingPicked ? 'is-on' : ''}`}
            aria-label={`선택한 경로 ${pickedRoutes.length}개 폴더 옮기기`}
            aria-expanded={movingPicked}
            disabled={pickedRoutes.length === 0}
            onClick={() => setMovingPicked((m) => !m)}
          >
            <FolderInput size={22} aria-hidden />
          </button>
          {movingPicked && pickedRoutes.length > 0 && (
            <div
              className="folder-picker folder-name-options route-folders__move-picker"
              role="dialog"
              aria-label="옮길 폴더"
              // As many columns as there are folders (미분류 too), five at most.
              style={{ gridTemplateColumns: `repeat(${Math.min(3, folders.folders.length + 1)}, minmax(0, 1fr))` }}
            >
              {[{ id: null, name: '미분류', icon: NONE_ICON }, ...folders.folders].map((f) => (
                <button
                  key={f.id ?? 'none'}
                  className="folder-picker__opt"
                  aria-label={f.name}
                  onClick={() => {
                    onFolders(pickedRoutes.reduce((acc, c) => moveRoute(acc, c.id, f.id), folders));
                    setSelected(new Set());
                    setMovingPicked(false);
                  }}
                >
                  {f.id ? f.name : NONE_ICON}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {selecting && (
        // 다중 선택: delete what's picked, by tapping or by dropping them here.
        <button
          className={`route-folders__trash ${rowDrag?.overTrash ? 'is-over' : ''}`}
          aria-label={`선택한 경로 ${pickedRoutes.length}개 삭제`}
          disabled={pickedRoutes.length === 0 && !rowDrag}
          onClick={() => {
            if (!pickedRoutes.length) return;
            onDeleteRoutes(pickedRoutes);
            setSelected(new Set());
          }}
        >
          <Trash2 size={22} aria-hidden />
        </button>
      )}

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
            <strong>{draggedRoute.title || '이름 없는 경로'}</strong>
            {folderOf(folders, draggedRoute.id) && <span className="route-row__folder">{folderName(folderOf(folders, draggedRoute.id)!)}</span>}
            {/* Several carried at once: how many. */}
            {rowDrag.ids.length > 1 && <span className="route-row--ghost__count">{rowDrag.ids.length}</span>}
          </div>
        </div>
      )}

      {/* The sheet's toolbar: ROUTES and its tools stay put while the routes scroll under them. */}
      <div className="route-folders__head">
        <h2 className="route-folders__title">
          <span>ROUTES</span>
          {current !== 'all' && current !== 'none' && <span className="route-folders__current-name">{folderName(current)}</span>}
        </h2>
        <div className="route-folders__tools">
          <button
            className={`route-folders__new route-folders__select ${selecting ? 'is-on' : ''}`}
            aria-label="여러 개 선택"
            aria-pressed={selecting}
            onClick={toggleSelecting}
          >
            <ListChecks size={20} aria-hidden />
          </button>
          <button className="route-folders__new" aria-label="새 경로 만들기" onClick={onNewRoute}>
            <Plus size={20} aria-hidden />
          </button>
        </div>
      </div>
      <div
        ref={bodyEl}
        className={`route-folders__body ${rowDrag ? 'is-sorting' : ''} ${selecting ? 'is-selecting' : ''}`}
        role="tabpanel"
        onClick={(e) => {
          // A tap on the sheet's empty space (not a row or a button) lets go of a route on show.
          if (shownId && !(e.target as Element).closest('button, a, input')) onShow(null);
        }}
      >
        {routes.length === 0 ? (
          // No routes at all: how to make one. A folder (or tab) with none of them: says so.
          <p className="route-folders__empty">
            {courses.length === 0 && (current === 'all' || current === 'none') ? (
              <>저장된 루트가 없어요.<br />드래그해 루트를 만들어 보세요.</>
            ) : '여기에 있는 경로가 없어요.'}
          </p>
        ) : (
          <ul className="route-folders__list">
            {routes.map((c, index) => {
              const filed = folderOf(folders, c.id);
              const shown = shownId === c.id;
              return (
                <li
                  key={c.id}
                  className={`route-row ${shown ? 'is-shown' : ''} ${rowDrag?.ids.includes(c.id) ? 'is-lifted' : ''} ${selected.has(c.id) ? 'is-picked' : ''}`}
                  style={rowShift(index) ? { transform: `translateY(${rowShift(index)}px)` } : undefined}
                >
                  <button
                    className="route-row__main"
                    aria-pressed={selecting ? selected.has(c.id) : shown}
                    {...rowHandlers(c, index)}
                    onClick={() => {
                      if (swallowRowClick.current) {
                        swallowRowClick.current = false;
                        return;
                      }
                      // Picking routes: a tap picks or unpicks it instead of showing it.
                      if (selecting) {
                        return setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        });
                      }
                      onShow(shown ? null : c);
                    }}
                  >
                    {selecting && (
                      <span className={`route-row__check ${selected.has(c.id) ? 'is-on' : ''}`} aria-hidden>
                        {selected.has(c.id) && <Check size={14} strokeWidth={3} />}
                      </span>
                    )}
                    {/* A stop on the dashed line down the list: hollow, filled for the route on show. */}
                    {!selecting && <span className={`route-row__dot ${shown ? 'is-on' : ''}`} aria-hidden />}
                    <strong>{c.title || '이름 없는 경로'}</strong>
                    {/* Its folder's name, after the route name (a route in none shows nothing). */}
                    {filed && (
                      <span className="route-row__folder" aria-label={`${folderName(filed)}에 있음`}>
                        {folderName(filed)}
                      </span>
                    )}
                  </button>
                  {/* The open route's tool: small, at its bottom right (delete asks first). */}
                  {shown && (
                    <div className="route-row__tools">
                      <button className="route-row__tool route-row__tool--danger" aria-label={`${c.title || '경로'} 삭제`} onClick={() => setDeletingRoute(c)}>
                        <Trash2 size={18} aria-hidden />
                      </button>
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
