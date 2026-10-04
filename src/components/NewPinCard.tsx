import { Check } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { addressRoute } from '../domain/addressRoute';
import { categoriesWithUncategorized, categoryStyle, findCategory, PIN_LIMITS, UNCATEGORIZED } from '../domain/pin';
import type { PlaceRef } from '../types/course';
import type { PinCategory } from '../types/pin';
import PinGlyph from './PinGlyph';

export interface NewPinInput {
  name: string;
  memo: string;
  categoryId: string;
}

interface NewPinCardProps {
  place: PlaceRef;
  categories: PinCategory[];
  /** ✓: pin it with what's on the card. */
  onSave: (input: NewPinInput) => void;
  /** A touch outside the card (or Esc): nothing is kept. */
  onClose: () => void;
}

/**
 * A place picked from search or by a long press on the map, before it is a
 * pin: the pin card's boarding pass, open for editing from the start (no
 * pen). The name is the place's, the memo starts empty, the group is 미분류;
 * the bin's corner holds ✓, which pins it. Touching anywhere else closes the
 * card and drops whatever was typed.
 */
export default function NewPinCard({ place, categories, onSave, onClose }: NewPinCardProps) {
  const [name, setName] = useState(place.name);
  const [memo, setMemo] = useState('');
  const [categoryId, setCategoryId] = useState(UNCATEGORIZED.id);
  const [picking, setPicking] = useState(false);
  const cardEl = useRef<HTMLDivElement | null>(null);
  const style = categoryStyle(categories, categoryId);
  const route = addressRoute(place.address);

  // A long press names the spot a moment later (reverse geocoding): take the
  // name then, unless it has already been typed over.
  const typed = useRef(false);
  useEffect(() => {
    if (!typed.current) setName(place.name);
  }, [place.name]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (cardEl.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);

  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div ref={cardEl} className="place-card place-card--pin pin-card pin-card--new is-editing" role="dialog" aria-label="새 핀">
      {picking && (
        <div className="folder-picker pin-card__icons" role="dialog" aria-label="그룹 고르기">
          {categoriesWithUncategorized(categories).map((category) => {
            const s = categoryStyle(categories, category.id);
            const on = category.id === categoryId;
            return (
              <button
                key={category.id}
                className={`folder-picker__opt pin-card__icon-opt ${on ? 'is-on' : ''}`}
                style={{ '--pin': `var(--pin-${s.color})` } as CSSProperties}
                aria-label={category.name}
                aria-pressed={on}
                onClick={() => {
                  setCategoryId(category.id);
                  setPicking(false);
                }}
              >
                <PinGlyph icon={s.icon} />
              </button>
            );
          })}
        </div>
      )}

      <div className="pin-card__main">
        {route && (
          <p className="pin-card__route" aria-label={`${route.from}${route.to ? `, ${route.to}` : ''}`}>
            <span>{route.from}</span>
            {route.to && (
              <>
                <span className="pin-card__arrow" aria-hidden>
                  →
                </span>
                <span>{route.to}</span>
              </>
            )}
          </p>
        )}
        <input
          className="pin-card__name-input"
          aria-label="장소 이름"
          value={name}
          maxLength={PIN_LIMITS.name}
          onChange={(e) => {
            typed.current = true;
            setName(e.target.value);
          }}
          onKeyDown={keys}
        />
        <input
          className="pin-card__memo-input"
          aria-label="한 줄 메모"
          placeholder="한 줄 메모를 입력하세요"
          value={memo}
          maxLength={PIN_LIMITS.memo}
          onChange={(e) => setMemo(e.target.value)}
          onKeyDown={keys}
        />
      </div>

      <div className="pin-card__stub">
        <span className="pin-card__group">GROUP</span>
        <button
          className="pin-card__category is-editable"
          style={{ '--pin': `var(--pin-${style.color})` } as CSSProperties}
          aria-label={`그룹 바꾸기 (지금 ${findCategory(categories, categoryId).name})`}
          aria-expanded={picking}
          onClick={() => setPicking((v) => !v)}
        >
          <PinGlyph icon={style.icon} />
        </button>
        <button
          className="icon-btn pin-card__confirm"
          aria-label="핀 꽂기"
          onClick={() => onSave({ name: name.trim().slice(0, PIN_LIMITS.name) || place.name, memo: memo.trim().slice(0, PIN_LIMITS.memo), categoryId })}
        >
          <Check size={22} aria-hidden />
        </button>
      </div>
    </div>
  );
}
