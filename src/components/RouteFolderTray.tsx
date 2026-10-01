import { FolderInput, Inbox, Layers, Plus, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  addFolder,
  deleteFolder,
  FOLDER_ICONS,
  folderOf,
  moveFolder,
  moveRoute,
  ROUTE_FOLDER_LIMITS,
  routesInTab,
  setFolderIcon,
  type RouteFolders,
  type RouteTab,
} from '../domain/routeFolders';
import type { Course } from '../types/course';

interface RouteFolderTrayProps {
  /** False while it slides away (it stays mounted for that). */
  open: boolean;
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
}

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
export default function RouteFolderTray({ open, courses, folders, onFolders, shownId, onShow, tab, onTab: setTab, onNewRoute }: RouteFolderTrayProps) {
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
  const tabOk = tab === 'all' || tab === 'none' || folders.folders.some((f) => f.id === tab);
  const current = tabOk ? tab : 'all';
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

  const endPress = () => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    window.clearTimeout(p.timer);
    if (!p.active) return;
    // The click that follows a long press shouldn't also select / pick.
    swallowClick.current = true;
    setLifted(null);
    const order = dragOrderRef.current;
    setDragOrder(null);
    if (!p.moved) return setDeleting(p.id);
    if (order) onFolders(moveFolder(foldersRef.current, p.id, order.indexOf(p.id)));
  };

  /** Long press → lift; then drag to reorder, or let go in place for the ✕. */
  const pressHandlers = (id: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      // Keep getting this pointer's moves once it leaves the tab (touch does
      // this by itself; a mouse doesn't).
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const p: Press = { id, x: e.clientX, y: e.clientY, timer: 0, active: false, moved: false };
      p.timer = window.setTimeout(() => {
        p.active = true;
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
      // Its new slot: how many of the other folder tabs sit left of the finger.
      const others = [...(tabsEl.current?.querySelectorAll<HTMLElement>('[data-folder]') ?? [])].filter((el) => el.dataset.folder !== id);
      const to = others.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2 < e.clientX;
      }).length;
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
        className={`route-folders__tab ${on ? 'is-on' : ''} ${lifted === id ? 'is-lifted' : ''}`}
        {...(custom ? pressHandlers(id) : {})}
        onClick={() => {
          if (swallowClick.current) {
            swallowClick.current = false;
            return;
          }
          setFiling(null);
          setDeleting(null);
          if (on && custom) return setPicking(picking === id ? null : id);
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

  const pickingFolder = folders.folders.find((f) => f.id === picking) ?? null;

  return (
    <section ref={sheetEl} className={`route-folders ${open ? '' : 'is-leaving'}`} aria-label="경로 폴더" inert={!open}>
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

      <div className="route-folders__body" role="tabpanel">
        <button className="route-folders__new" aria-label="새 경로 만들기" onClick={onNewRoute}>
          <Plus size={20} aria-hidden />
        </button>
        {routes.length === 0 ? (
          <p className="route-folders__empty">
            {courses.length === 0 ? '저장한 경로가 없어요. 오른쪽 위 + 로 핀을 이어 만들어 보세요.' : current === 'all' || current === 'none' ? '여기에 있는 경로가 없어요.' : '이 폴더는 비어 있어요. 경로의 폴더 버튼으로 넣어 보세요. 탭을 한 번 더 누르면 아이콘을 바꿀 수 있어요.'}
          </p>
        ) : (
          <ul className="route-folders__list">
            {routes.map((c) => {
              const filed = folderOf(folders, c.id);
              const filedIn = folders.folders.find((f) => f.id === filed);
              return (
                <li key={c.id} className={`route-row ${shownId === c.id ? 'is-shown' : ''}`}>
                  <button className="route-row__main" aria-pressed={shownId === c.id} onClick={() => onShow(shownId === c.id ? null : c)}>
                    <strong>{c.title || '이름 없는 경로'}</strong>
                    <span>
                      {c.stops.length}곳 ·{' '}
                      <span className="route-row__in" aria-label={filedIn?.name ?? '미분류'}>
                        {filedIn ? filedIn.icon : <Inbox size={14} aria-hidden />}
                      </span>
                    </span>
                  </button>
                  <button
                    className="route-row__file icon-btn"
                    aria-label={`${c.title || '경로'} 폴더 옮기기`}
                    aria-expanded={filing === c.id}
                    onClick={() => setFiling(filing === c.id ? null : c.id)}
                  >
                    <FolderInput size={20} aria-hidden />
                  </button>
                  {filing === c.id && (
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
