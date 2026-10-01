import { Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { COURSE_LIMITS } from '../domain/course';

interface RouteTitleProps {
  title: string;
  onRename: (title: string) => void;
}

/**
 * The name of the route on show, big at the top of the map like a calendar
 * day's "TODAY", with a small pen at its bottom right: tap it to rename in
 * place (the pen again, Enter or a tap elsewhere sets it; Escape keeps the old one).
 */
export default function RouteTitle({ title, onRename }: RouteTitleProps) {
  const [editing, setEditing] = useState(false);
  const inputEl = useRef<HTMLInputElement | null>(null);

  // Another route: back to just its name.
  useEffect(() => setEditing(false), [title]);

  const commit = () => {
    const next = (inputEl.current?.value ?? '').trim().slice(0, COURSE_LIMITS.title);
    if (next && next !== title) onRename(next);
    setEditing(false);
  };

  return (
    <div className="route-title">
      {editing ? (
        <input
          ref={inputEl}
          className="route-title__input"
          aria-label="루트 이름"
          defaultValue={title}
          maxLength={COURSE_LIMITS.title}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <h2 className="route-title__name">{title}</h2>
      )}
      <button
        className="route-title__pen"
        aria-label={editing ? '이름 확정' : '루트 이름 바꾸기'}
        aria-pressed={editing}
        // While editing, keep the field focused: a blur first would save and close
        // it, and this tap would then open it again.
        onPointerDown={(e) => editing && e.preventDefault()}
        onClick={() => (editing ? commit() : setEditing(true))}
      >
        <Pencil size={13} aria-hidden />
      </button>
    </div>
  );
}
