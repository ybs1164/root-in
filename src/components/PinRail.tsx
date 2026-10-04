import { MapPin, Route } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { categoriesWithUncategorized, categoryStyle, UNCATEGORIZED } from '../domain/pin';
import { isAllPicked, type PinRailEntry, type PinRailMode } from '../domain/pinRail';
import type { PinCategory } from '../types/pin';
import PinGlyph from './PinGlyph';

interface PinRailProps {
  mode: PinRailMode;
  onAction: (entry: PinRailEntry) => void;
  categories: PinCategory[];
  /** Pins per category id, for the labels. */
  counts: Map<string, number>;
  picked: ReadonlySet<string>;
  onToggle: (categoryId: string) => void;
  /** ALL: back to every pin (drops the picked categories). */
  onAll: () => void;
}

/** Matches `pin-rail-out` in styles.css; the category list stays mounted until it has gone. */
const OUT_MS = 160;

/** How long 경로 takes to glide to its new place when the list opens or closes. */
const GLIDE_MS = 280;

/** Per-button delay index, capped so a long list doesn't keep the last ones waiting. */
const stagger = (i: number): CSSProperties => ({ '--i': Math.min(i, 8) }) as CSSProperties;

const ENTRIES: { entry: PinRailEntry; label: string; icon: ReactNode }[] = [
  { entry: 'pins', label: '핀', icon: <MapPin aria-hidden /> },
  { entry: 'route', label: '경로', icon: <Route aria-hidden /> },
];

/**
 * Round buttons under ⚙ on the pin screen, in place of the old sheet. 핀
 * and 경로 each open on a tap and take the accent colour; a second tap
 * closes. 핀 opens one button per category below it, and 경로 moves down
 * below that list; picking categories narrows the map to them, and the map
 * stays narrowed after 핀 closes.
 */
export default function PinRail({ mode, onAction, categories, counts, picked, onToggle, onAll }: PinRailProps) {
  // ALL is on while nothing that exists (미분류 included) is picked.
  const allOn = isAllPicked(picked, [UNCATEGORIZED.id, ...categories.map((c) => c.id)]);
  // The category list trails the mode so it can play out before unmounting.
  const listOpen = mode === 'pins';
  const [listShown, setListShown] = useState(listOpen);
  useEffect(() => {
    if (listOpen) return setListShown(true);
    const t = window.setTimeout(() => setListShown(false), OUT_MS);
    return () => window.clearTimeout(t);
  }, [listOpen]);

  // 경로 glides to its new place (below the list, or back up) rather than
  // jumping there: it starts where it was and slides home (FLIP).
  const routeSlot = useRef<HTMLDivElement | null>(null);
  const lastTop = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = routeSlot.current;
    if (!el) return;
    const top = el.offsetTop;
    const before = lastTop.current;
    lastTop.current = top;
    if (before === null || before === top || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.style.transition = 'none';
    el.style.transform = `translateY(${before - top}px)`;
    void el.offsetHeight;
    el.style.transition = `transform ${GLIDE_MS}ms cubic-bezier(0.2, 0.9, 0.3, 1)`;
    el.style.transform = '';
  });

  const entryButton = ({ entry, label, icon }: (typeof ENTRIES)[number]) => {
    const on = mode === entry;
    return (
      <div key={entry} ref={entry === 'route' ? routeSlot : undefined} className="pin-rail__slot">
        <button className={`pin-rail__btn ${on ? 'is-on' : ''}`} aria-label={label} aria-expanded={on} onClick={() => onAction(entry)}>
          {icon}
        </button>
      </div>
    );
  };

  return (
    <nav className="pin-rail" aria-label="핀 메뉴">
      {entryButton(ENTRIES[0])}

      {listShown && (
        <ul className="pin-rail__list" aria-label="내 핀">
          {/* ALL first: every pin (on whenever no category is picked; never together with one). */}
          <li className={`pin-rail__item ${listOpen ? '' : 'is-leaving'}`} style={stagger(0)}>
            <button
              className={`pin-rail__btn pin-rail__all ${allOn ? 'is-on' : ''}`}
              aria-label="모든 핀"
              aria-pressed={allOn}
              onClick={onAll}
            >
              ALL
            </button>
          </li>
          {/* Then 미분류 (always there, right under ALL), then the categories. */}
          {categoriesWithUncategorized(categories).map(({ category }, i) => {
            const style = categoryStyle(categories, category.id);
            const on = picked.has(category.id);
            return (
              <li key={category.id} className={`pin-rail__item ${listOpen ? '' : 'is-leaving'}`} style={stagger(i + 1)}>
                <button
                  className={`pin-rail__btn pin-rail__pin ${on ? 'is-on' : ''}`}
                  style={{ '--pin': `var(--pin-${style.color})` } as CSSProperties}
                  aria-label={`${category.name} ${counts.get(category.id) ?? 0}곳`}
                  aria-pressed={on}
                  onClick={() => onToggle(category.id)}
                >
                  <PinGlyph icon={style.icon} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* 경로 stays: with 핀's list out it simply moves down below the list. */}
      {entryButton(ENTRIES[1])}
    </nav>
  );
}
