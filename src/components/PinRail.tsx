import { ArrowLeft, ChevronDown, ChevronUp, MapPin, Route } from 'lucide-react';
import type { CSSProperties } from 'react';
import { categoryStyle, orderedCategories } from '../domain/pin';
import type { PinRailAction, PinRailMode } from '../domain/pinRail';
import type { PinCategory } from '../types/pin';

interface PinRailProps {
  mode: PinRailMode;
  onAction: (action: PinRailAction) => void;
  categories: PinCategory[];
  /** Pins per category id, for the labels. */
  counts: Map<string, number>;
  picked: ReadonlySet<string>;
  onToggle: (categoryId: string) => void;
}

/**
 * Round buttons under ⚙ on the pin screen, in place of the old sheet. The
 * fold button stays on top; 핀 swaps the entries for one button per
 * category, and picking some narrows the map to them.
 */
export default function PinRail({ mode, onAction, categories, counts, picked, onToggle }: PinRailProps) {
  const folded = mode === 'folded';
  return (
    <nav className="pin-rail" aria-label="핀 메뉴">
      <button
        className="pin-rail__btn"
        aria-label={folded ? '펼치기' : '접기'}
        aria-expanded={!folded}
        onClick={() => onAction('fold')}
      >
        {folded ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
      </button>

      {mode === 'menu' && (
        <>
          <button className="pin-rail__btn" aria-label="핀" onClick={() => onAction('pins')}>
            <MapPin aria-hidden />
          </button>
          <button className="pin-rail__btn" aria-label="경로" onClick={() => onAction('route')}>
            <Route aria-hidden />
          </button>
        </>
      )}

      {mode === 'pins' && (
        <>
          <button className="pin-rail__btn" aria-label="뒤로" onClick={() => onAction('back')}>
            <ArrowLeft aria-hidden />
          </button>
          <ul className="pin-rail__list" aria-label="내 핀">
            {orderedCategories(categories).map(({ category }) => {
              const style = categoryStyle(categories, category.id);
              const on = picked.has(category.id);
              return (
                <li key={category.id}>
                  <button
                    className={`pin-rail__btn pin-rail__pin ${on ? 'is-on' : ''}`}
                    style={{ '--pin': `var(--pin-${style.color})` } as CSSProperties}
                    aria-label={`${category.name} ${counts.get(category.id) ?? 0}곳`}
                    aria-pressed={on}
                    onClick={() => onToggle(category.id)}
                  >
                    <span aria-hidden>{style.emoji}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </nav>
  );
}
