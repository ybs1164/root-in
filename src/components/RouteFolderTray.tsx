import { FolderInput, Inbox, Layers, Plus } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  addFolder,
  FOLDER_ICONS,
  folderOf,
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
}

/** The fixed tabs wear line icons, set apart from the folders' own emoji. */
const ALL_ICON = <Layers size={20} aria-hidden />;
const NONE_ICON = <Inbox size={20} aria-hidden />;

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
 * that tab, like a ping's shape picker on TODAY.
 */
export default function RouteFolderTray({ open, courses, folders, onFolders, shownId, onShow }: RouteFolderTrayProps) {
  const [tab, setTab] = useState<RouteTab>('all');
  // The folder whose icon picker is out.
  const [picking, setPicking] = useState<string | null>(null);
  // The route whose 폴더 chooser is out.
  const [filing, setFiling] = useState<string | null>(null);
  const tabsEl = useRef<HTMLDivElement | null>(null);

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

  /** Every tab is just an icon: a line icon for the fixed two, the folder's own emoji otherwise. */
  const tabButton = (id: RouteTab, label: string, icon: ReactNode) => {
    const on = current === id;
    const custom = id !== 'all' && id !== 'none';
    return (
      <button
        key={id}
        data-tab={id}
        role="tab"
        aria-selected={on}
        aria-label={custom && on ? `${label}, 다시 누르면 아이콘 바꾸기` : label}
        className={`route-folders__tab ${on ? 'is-on' : ''}`}
        onClick={() => {
          setFiling(null);
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
        {routes.length === 0 ? (
          <p className="route-folders__empty">
            {courses.length === 0 ? '저장한 경로가 없어요.' : current === 'all' || current === 'none' ? '여기에 있는 경로가 없어요.' : '이 폴더는 비어 있어요. 경로의 폴더 버튼으로 넣어 보세요. 탭을 한 번 더 누르면 아이콘을 바꿀 수 있어요.'}
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
