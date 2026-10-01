import { MapPin, Route } from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { categoryStyle, orderedCategories } from '../domain/pin';
import type { PinRailEntry, PinRailMode } from '../domain/pinRail';
import type { PinCategory } from '../types/pin';

interface PinRailProps {
  mode: PinRailMode;
  onAction: (entry: PinRailEntry) => void;
  categories: PinCategory[];
  /** Pins per category id, for the labels. */
  counts: Map<string, number>;
  picked: ReadonlySet<string>;
  onToggle: (categoryId: string) => void;
}

/** Matches `pin-rail-out` in styles.css; the category list stays mounted until it has gone. */
const OUT_MS = 160;

/** Per-button delay index, capped so a long list doesn't keep the last ones waiting. */
const stagger = (i: number): CSSProperties => ({ '--i': Math.min(i, 8) }) as CSSProperties;

const ENTRIES: { entry: PinRailEntry; label: string; icon: ReactNode }[] = [
  { entry: 'pins', label: '핀', icon: <MapPin aria-hidden /> },
  { entry: 'route', label: '경로', icon: <Route aria-hidden /> },
];

/**
 * Round buttons under ⚙ on the pin screen, in place of the old sheet. 핀
 * and 경로 each open on a tap and take the accent colour; a second tap
 * closes. 핀 shrinks 경로 away for its list, while 경로 leaves 핀 in place. 핀 opens one button per category below it; picking some
 * narrows the map to them, and the map stays narrowed after 핀 closes.
 */
export default function PinRail({ mode, onAction, categories, counts, picked, onToggle }: PinRailProps) {
  // The category list trails the mode so it can play out before unmounting.
  const listOpen = mode === 'pins';
  const [listShown, setListShown] = useState(listOpen);
  useEffect(() => {
    if (listOpen) return setListShown(true);
    const t = window.setTimeout(() => setListShown(false), OUT_MS);
    return () => window.clearTimeout(t);
  }, [listOpen]);

  return (
    <nav className="pin-rail" aria-label="핀 메뉴">
      {ENTRIES.map(({ entry, label, icon }) => {
        const on = mode === entry;
        // Only 핀's category list puts the other button away; 경로 keeps 핀 in view.
        const hidden = mode === 'pins' && entry === 'route';
        return (
          // Collapsing the slot (not just hiding the button) lets the one below move up.
          <div key={entry} className={`pin-rail__slot ${hidden ? 'is-hidden' : ''}`} inert={hidden}>
            <button
              className={`pin-rail__btn ${on ? 'is-on' : ''}`}
              aria-label={label}
              aria-expanded={on}
              onClick={() => onAction(entry)}
            >
              {icon}
            </button>
          </div>
        );
      })}

      {listShown && (
        <ul className="pin-rail__list" aria-label="내 핀">
          {orderedCategories(categories).map(({ category }, i) => {
            const style = categoryStyle(categories, category.id);
            const on = picked.has(category.id);
            return (
              <li key={category.id} className={`pin-rail__item ${listOpen ? '' : 'is-leaving'}`} style={stagger(i)}>
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
