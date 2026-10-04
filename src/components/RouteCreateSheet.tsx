import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ROUTE_NOTE_MAX, ROUTE_TITLE_MAX } from '../domain/routeBuild';
import type { RouteFolder } from '../domain/routeFolders';

/** What the sheet holds so far; kept by the build layer so it survives the sheet going down and up. */
export interface RouteCreateDraft {
  title: string;
  note: string;
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
 *   [description (5 lines)] [생성]
 *
 * The folder starts blank (미분류) and opens a small grid above its button;
 * a tap anywhere else closes it. A route has no icon of its own: its folder
 * is the only thing it is filed by.
 */
export default function RouteCreateSheet({ draft, onDraft, defaultTitle, folders, leaving, onCreate }: RouteCreateSheetProps) {
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    if (!picking) return;
    const away = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest('.route-create__pick')) setPicking(false);
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
            aria-expanded={picking}
            onClick={() => setPicking(!picking)}
          >
            {folder?.icon}
          </button>
          {picking && (
            <div className="folder-picker route-create__grid" role="group" aria-label="폴더">
              <button
                className={`folder-picker__opt ${!folder ? 'is-on' : ''}`}
                aria-label="미분류"
                aria-pressed={!folder}
                onClick={() => {
                  onDraft({ ...draft, folder: null });
                  setPicking(false);
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
                    setPicking(false);
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
        {/* The description box, five lines tall. */}
        <div className="route-create__note-box">
          <textarea
            className="route-create__note"
            aria-label="설명"
            placeholder="설명"
            rows={5}
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
