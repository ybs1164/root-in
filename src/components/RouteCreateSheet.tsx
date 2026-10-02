import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ROUTE_NOTE_MAX, ROUTE_TITLE_MAX } from '../domain/routeBuild';
import type { RouteFolder } from '../domain/routeFolders';
import { RouteIconFace, RouteIconOptions } from './RouteIconOptions';

/** What the sheet holds so far; kept by the build layer so it survives the sheet going down and up. */
export interface RouteCreateDraft {
  title: string;
  note: string;
  icon?: string;
  /** null = 미분류. */
  folder: string | null;
}

interface RouteCreateSheetProps {
  draft: RouteCreateDraft;
  onDraft: (draft: RouteCreateDraft) => void;
  /** Used when the name is left empty. */
  defaultTitle: string;
  folders: RouteFolder[];
  /** Sliding away (fewer than two stops); it stays mounted for that. */
  leaving: boolean;
  onCreate: () => void;
}

/**
 * Making a route: the sheet that rises once it has two stops.
 *
 *   [folder] [name ✎]
 *   [[icon] description (3 lines)] [생성]
 *
 * Folder and icon start blank (미분류, no icon) and each opens a small grid
 * above its button; a tap anywhere else closes it.
 */
export default function RouteCreateSheet({ draft, onDraft, defaultTitle, folders, leaving, onCreate }: RouteCreateSheetProps) {
  const [picking, setPicking] = useState<'folder' | 'icon' | null>(null);
  useEffect(() => {
    if (!picking) return;
    const away = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest('.route-create__pick')) setPicking(null);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [picking]);

  const folder = folders.find((f) => f.id === draft.folder) ?? null;

  return (
    <section className={`route-create ${leaving ? 'is-leaving' : ''}`} aria-label="루트 만들기" inert={leaving}>
      <div className="route-create__row">
        <div className="route-create__pick">
          <button
            className="route-create__btn"
            aria-label={`폴더 ${folder?.name ?? '미분류'}, 바꾸기`}
            aria-expanded={picking === 'folder'}
            onClick={() => setPicking(picking === 'folder' ? null : 'folder')}
          >
            {folder?.icon}
          </button>
          {picking === 'folder' && (
            <div className="folder-picker route-create__grid" role="group" aria-label="폴더">
              <button
                className={`folder-picker__opt ${!folder ? 'is-on' : ''}`}
                aria-label="미분류"
                aria-pressed={!folder}
                onClick={() => {
                  onDraft({ ...draft, folder: null });
                  setPicking(null);
                }}
              />
              {folders.map((f) => (
                <button
                  key={f.id}
                  className={`folder-picker__opt ${draft.folder === f.id ? 'is-on' : ''}`}
                  aria-label={f.name}
                  aria-pressed={draft.folder === f.id}
                  onClick={() => {
                    onDraft({ ...draft, folder: f.id });
                    setPicking(null);
                  }}
                >
                  {f.icon}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="route-create__name">
          <input
            aria-label="루트 이름"
            value={draft.title}
            placeholder={defaultTitle}
            maxLength={ROUTE_TITLE_MAX}
            onChange={(e) => onDraft({ ...draft, title: e.target.value })}
          />
          {/* A faint pen: the name is there to be changed. */}
          <Pencil className="route-create__pen" size={16} aria-hidden />
        </label>
      </div>
      <div className="route-create__row route-create__row--note">
        {/* The description box, three lines tall, with the icon in its corner. */}
        <div className="route-create__note-box">
          <div className="route-create__pick">
            <button
              className="route-create__btn route-create__btn--icon"
              aria-label={`아이콘 ${draft.icon ?? '없음'}, 바꾸기`}
              aria-expanded={picking === 'icon'}
              onClick={() => setPicking(picking === 'icon' ? null : 'icon')}
            >
              <RouteIconFace icon={draft.icon} />
            </button>
            {picking === 'icon' && (
              <div className="folder-picker route-create__grid" role="group" aria-label="아이콘">
                <RouteIconOptions
                  value={draft.icon}
                  onPick={(icon) => {
                    onDraft({ ...draft, icon });
                    setPicking(null);
                  }}
                />
              </div>
            )}
          </div>
          <textarea
            className="route-create__note"
            aria-label="설명"
            placeholder="설명"
            rows={3}
            value={draft.note}
            maxLength={ROUTE_NOTE_MAX}
            onChange={(e) => onDraft({ ...draft, note: e.target.value })}
          />
        </div>
        <button className="route-create__go" onClick={onCreate}>
          생성
        </button>
      </div>
    </section>
  );
}
