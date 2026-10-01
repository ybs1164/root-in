import { FolderInput, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  addFolder,
  folderOf,
  moveRoute,
  renameFolder,
  ROUTE_FOLDER_LIMITS,
  routesInTab,
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

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * 경로 폴더: a sheet rising in the tab buttons' place, with index tabs along
 * its top edge like a file folder's. 전체 lists every saved route, 미분류 the
 * ones not filed anywhere, then the user's own folders, and + adds one
 * (named right away in the new tab). Tapping the open folder's tab again
 * renames it.
 */
export default function RouteFolderTray({ open, courses, folders, onFolders, shownId, onShow }: RouteFolderTrayProps) {
  const [tab, setTab] = useState<RouteTab>('all');
  const [renaming, setRenaming] = useState<string | null>(null);
  // The route whose 폴더 chooser is out.
  const [filing, setFiling] = useState<string | null>(null);
  const tabsEl = useRef<HTMLDivElement | null>(null);

  // A deleted-elsewhere folder can't stay selected.
  const tabOk = tab === 'all' || tab === 'none' || folders.folders.some((f) => f.id === tab);
  const current = tabOk ? tab : 'all';
  const routes = routesInTab(courses, folders, current);
  const count = (t: RouteTab) => routesInTab(courses, folders, t).length;

  const add = () => {
    const id = newId();
    const next = addFolder(folders, id);
    if (!next) return;
    onFolders(next);
    setTab(id);
    setRenaming(id);
  };

  // The new tab sits at the end, next to +: bring it into view.
  useEffect(() => {
    if (!renaming) return;
    tabsEl.current?.querySelector<HTMLElement>(`[data-tab="${renaming}"]`)?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [renaming]);

  const tabButton = (id: RouteTab, label: string) => {
    const on = current === id;
    const custom = id !== 'all' && id !== 'none';
    if (custom && renaming === id) {
      return (
        <input
          key={id}
          data-tab={id}
          className="route-folders__tab route-folders__tab--edit is-on"
          aria-label="폴더 이름"
          defaultValue={label}
          maxLength={ROUTE_FOLDER_LIMITS.name}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => {
            onFolders(renameFolder(folders, id, e.currentTarget.value));
            setRenaming(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
          }}
        />
      );
    }
    return (
      <button
        key={id}
        data-tab={id}
        role="tab"
        aria-selected={on}
        className={`route-folders__tab ${on ? 'is-on' : ''}`}
        onClick={() => {
          if (on && custom) setRenaming(id);
          else setTab(id);
          setFiling(null);
        }}
      >
        {label}
        <span className="route-folders__count">{count(id)}</span>
      </button>
    );
  };

  return (
    <section className={`route-folders ${open ? '' : 'is-leaving'}`} aria-label="경로 폴더" inert={!open}>
      <div ref={tabsEl} className="route-folders__tabs" role="tablist" aria-label="폴더">
        {tabButton('all', '전체')}
        {tabButton('none', '미분류')}
        {folders.folders.map((f) => tabButton(f.id, f.name))}
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
            {courses.length === 0 ? '저장한 경로가 없어요.' : current === 'all' || current === 'none' ? '여기에 있는 경로가 없어요.' : '이 폴더는 비어 있어요. 경로의 폴더 버튼으로 넣어 보세요.'}
          </p>
        ) : (
          <ul className="route-folders__list">
            {routes.map((c) => {
              const filed = folderOf(folders, c.id);
              const filedName = folders.folders.find((f) => f.id === filed)?.name ?? '미분류';
              return (
                <li key={c.id} className={`route-row ${shownId === c.id ? 'is-shown' : ''}`}>
                  <button className="route-row__main" aria-pressed={shownId === c.id} onClick={() => onShow(shownId === c.id ? null : c)}>
                    <strong>{c.title || '이름 없는 경로'}</strong>
                    <span>
                      {c.stops.length}곳 · {filedName}
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
                      {[{ id: null, name: '미분류' }, ...folders.folders].map((f) => (
                        <button
                          key={f.id ?? 'none'}
                          className={`pill ${filed === f.id ? 'pill--on' : ''}`}
                          aria-pressed={filed === f.id}
                          onClick={() => {
                            onFolders(moveRoute(folders, c.id, f.id));
                            setFiling(null);
                          }}
                        >
                          {f.name}
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
