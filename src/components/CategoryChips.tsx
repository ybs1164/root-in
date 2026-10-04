import type { CSSProperties } from 'react';
import { categoryStyle, orderedCategories } from '../domain/pin';
import type { PinCategory } from '../types/pin';
import PinGlyph from './PinGlyph';

interface CategoryChipsProps {
  categories: PinCategory[];
  onPick: (id: string) => void;
  /** Most recently used first; these jump to the front. */
  recent?: string[];
  selected?: string | null;
  /** Adds a leading "전체" chip (filters). */
  allLabel?: string;
  label: string;
}

/** One tap = one choice. */
export default function CategoryChips({ categories, onPick, recent = [], selected, allLabel, label }: CategoryChipsProps) {
  const ordered = orderedCategories(categories);
  const rank = (id: string) => {
    const i = recent.indexOf(id);
    return i === -1 ? Infinity : i;
  };
  const list = recent.length > 0 ? [...ordered].sort((a, b) => rank(a.id) - rank(b.id)) : ordered;

  return (
    <div className="chip-row cat-chips" role="group" aria-label={label}>
      {allLabel !== undefined && (
        <button className={`chip ${selected === null ? 'chip--on' : ''}`} aria-pressed={selected === null} onClick={() => onPick('')}>
          {allLabel}
        </button>
      )}
      {list.map((category) => {
        const style = categoryStyle(categories, category.id);
        const on = selected === category.id;
        return (
          <button
            key={category.id}
            className={`chip cat-chip ${on ? 'cat-chip--on' : ''}`}
            style={{ '--pin': `var(--pin-${style.color})` } as CSSProperties}
            aria-pressed={on}
            onClick={() => onPick(category.id)}
          >
            <span className="cat-chip__dot" aria-hidden>
              <PinGlyph icon={style.icon} />
            </span>
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
