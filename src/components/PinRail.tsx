import { ChevronUp, MapPin, Route } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
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

/** The buttons under the fold button: the entries, the category list, or none. */
type Group = 'menu' | 'pins' | null;
const groupOf = (mode: PinRailMode): Group => (mode === 'menu' || mode === 'pins' ? mode : null);

/** Matches `pin-rail-out` in styles.css; the old buttons stay mounted until they have gone. */
const OUT_MS = 160;

/** Per-button delay index, capped so a long list doesn't keep the last ones waiting. */
const stagger = (i: number): CSSProperties => ({ '--i': Math.min(i, 8) }) as CSSProperties;

/**
 * Round buttons under ⚙ on the pin screen, in place of the old sheet. The
 * fold button stays on top; 핀 swaps the entries for one button per
 * category, and picking some narrows the map to them. Buttons pop out of
 * the fold button one after another, and tuck back into it before the next
 * set comes out.
 */
export default function PinRail({ mode, onAction, categories, counts, picked, onToggle }: PinRailProps) {
  const folded = mode === 'folded';
  const target = groupOf(mode);
  // `shown` trails `target`: a change first plays the old buttons out.
  const [shown, setShown] = useState<Group>(target);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (target === shown) {
      setLeaving(false);
      return;
    }
    if (shown === null) {
      setShown(target);
      return;
    }
    setLeaving(true);
    const t = window.setTimeout(() => {
      setShown(target);
      setLeaving(false);
    }, OUT_MS);
    return () => window.clearTimeout(t);
  }, [target, shown]);

  const motion = `pin-rail__item ${leaving ? 'is-leaving' : ''}`;

  return (
    <nav className="pin-rail" aria-label="핀 메뉴">
      <button
        className={`pin-rail__btn pin-rail__fold ${folded ? 'is-folded' : ''}`}
        aria-label={folded ? '펼치기' : '접기'}
        aria-expanded={!folded}
        onClick={() => onAction('fold')}
      >
        <ChevronUp aria-hidden />
      </button>

      {shown === 'menu' && (
        <>
          <button className={`pin-rail__btn ${motion}`} style={stagger(0)} aria-label="핀" onClick={() => onAction('pins')}>
            <MapPin aria-hidden />
          </button>
          <button className={`pin-rail__btn ${motion}`} style={stagger(1)} aria-label="경로" onClick={() => onAction('route')}>
            <Route aria-hidden />
          </button>
        </>
      )}

      {shown === 'pins' && (
        <ul className="pin-rail__list" aria-label="내 핀">
          {orderedCategories(categories).map(({ category }, i) => {
            const style = categoryStyle(categories, category.id);
            const on = picked.has(category.id);
            return (
              <li key={category.id} className={motion} style={stagger(i)}>
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
      )}
    </nav>
  );
}
