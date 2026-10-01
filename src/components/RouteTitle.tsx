import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { COURSE_LIMITS } from '../domain/course';

interface RouteTitleProps {
  routeId: string;
  title: string;
  onRename: (title: string) => void;
  /** The side this route's name slides in from (an arrow stepped to it), 0 when it just appears. */
  slideFrom?: -1 | 0 | 1;
  /** < > to the route above / below in the open tab's list; left out, no arrows. */
  onStep?: (step: -1 | 1) => void;
  /** The pen: into editing the route (its stops, order and description). */
  onEdit?: () => void;
  /** Editing the route: no pen or arrows, and a tap on the name renames it. */
  editMode?: boolean;
}

/** Matches the calendar's day paging (CalendarZoom SLIDE_MS) and .route-title--in / --out. */
const SLIDE_MS = 260;

/**
 * The name of the route on show, big at the top of the map like a calendar
 * day's "TODAY", with a small pen at its bottom right that opens editing the
 * route. While editing, a tap on the name renames it in place (Enter or a tap
 * elsewhere sets it; Escape keeps the old one). The field looks just like the
 * name, so only the text changes.
 */
export default function RouteTitle({ routeId, title, onRename, slideFrom = 0, onStep, onEdit, editMode = false }: RouteTitleProps) {
  const [editing, setEditing] = useState(false);
  // What's typed so far, mirrored into a hidden copy that sizes the field to its text.
  const [draft, setDraft] = useState(title);
  const inputEl = useRef<HTMLInputElement | null>(null);

  // Another route: back to just its name.
  useEffect(() => setEditing(false), [title]);

  // Stepping to a neighbour pages the names like days on the calendar: the
  // old name slides off the other way while the new one comes in.
  const last = useRef({ routeId, title });
  const [leaving, setLeaving] = useState<{ title: string; to: -1 | 1; key: string } | null>(null);
  useLayoutEffect(() => {
    const before = last.current;
    last.current = { routeId, title };
    if (before.routeId === routeId) return;
    if (!slideFrom) return setLeaving(null);
    setLeaving({ title: before.title, to: slideFrom === 1 ? -1 : 1, key: before.routeId });
    const t = window.setTimeout(() => setLeaving(null), SLIDE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const commit = () => {
    const next = (inputEl.current?.value ?? '').trim().slice(0, COURSE_LIMITS.title);
    if (next && next !== title) onRename(next);
    setEditing(false);
  };

  return (
    <>
      {leaving && (
        <div
          key={leaving.key}
          className="route-title route-title--out"
          style={{ '--slide': leaving.to } as CSSProperties}
          aria-hidden
        >
          <h2 className="route-title__name">{leaving.title}</h2>
          <span className="route-title__pen" />
        </div>
      )}
      <div
        key={routeId}
        className={`route-title ${slideFrom ? 'route-title--in' : ''}`}
        style={slideFrom ? ({ '--slide': slideFrom } as CSSProperties) : undefined}
      >
        {editing ? (
          <span className="route-title__name route-title__field">
            <span className="route-title__sizer" aria-hidden>
              {draft || ' '}
            </span>
            <input
              ref={inputEl}
              className="route-title__input"
              aria-label="루트 이름"
              value={draft}
              maxLength={COURSE_LIMITS.title}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
          </span>
        ) : (
          <h2
            className={`route-title__name ${editMode ? 'is-renamable' : ''}`}
            onClick={
              editMode
                ? () => {
                    setDraft(title);
                    setEditing(true);
                  }
                : undefined
            }
          >
            {title}
          </h2>
        )}
        {(!editMode || editing) && (
        <button
          className="route-title__pen"
          aria-label={editing ? '이름 확정' : '루트 수정'}
          aria-pressed={editing}
          // While editing, keep the field focused: a blur first would save and close
          // it, and this tap would then open it again.
          onPointerDown={(e) => editing && e.preventDefault()}
          onClick={() => {
            if (editing) return commit();
            if (onEdit) return onEdit();
            setDraft(title);
            setEditing(true);
          }}
        >
          <Pencil size={13} aria-hidden />
        </button>
        )}
      </div>
      {onStep && !editMode && (
        <>
          <button className="route-step route-step--prev" aria-label="이전 루트" onClick={() => onStep(-1)}>
            <ChevronLeft size={30} strokeWidth={2.2} aria-hidden />
          </button>
          <button className="route-step route-step--next" aria-label="다음 루트" onClick={() => onStep(1)}>
            <ChevronRight size={30} strokeWidth={2.2} aria-hidden />
          </button>
        </>
      )}
    </>
  );
}
