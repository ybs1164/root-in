import { Plus } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { addressRoute } from '../domain/addressRoute';
import { categoriesWithUncategorized, categoryStyle, findCategory, PIN_LIMITS, pinColorCss, pinStyle, suggestCategory } from '../domain/pin';
import type { PlaceRef } from '../types/course';
import type { PinCategory } from '../types/pin';
import PinGlyph from './PinGlyph';
import PlacePhotos from './PlacePhotos';
import PlaceSticker from './PlaceSticker';
import type { PlacePhoto } from '../domain/visitedPlaces';

export interface NewPinInput {
  name: string;
  memo: string;
  categoryId: string;
}

interface NewPinCardProps {
  /** The address the FROM → TO line reads, when the place's own can't give one (usePlaceAddress). */
  address?: string;
  place: PlaceRef;
  categories: PinCategory[];
  /** The photos I took there, newest first: shown above the card. */
  photos?: readonly PlacePhoto[];
  /** The middle photo tapped: open it big (its index in `photos`). */
  onOpenPhoto?: (index: number) => void;
  /** The photos' gallery button: MY, searched for this place. */
  onOpenGallery?: () => void;
  /** +: pin it with what's on the card. */
  onSave: (input: NewPinInput) => void;
  /** A touch outside the card (or Esc): nothing is kept. */
  onClose: () => void;
}

/**
 * A place picked from search or by a long press on the map, before it is a
 * pin: the pin card's boarding pass, open for editing from the start (no
 * pen). Far left, the place's sticker; the name is the place's, the memo
 * starts empty, the group is the one category drawn with the place's kind
 * icon (else 미분류); the bin's corner holds +, which pins it. Touching anywhere else closes the
 * card and drops whatever was typed.
 */
export default function NewPinCard({ place, categories, address, photos = [], onOpenPhoto, onOpenGallery, onSave, onClose }: NewPinCardProps) {
  const [name, setName] = useState(place.name);
  const [memo, setMemo] = useState('');
  const [categoryId, setCategoryId] = useState(() => suggestCategory(categories, place.kind));
  const [picking, setPicking] = useState(false);
  const cardEl = useRef<HTMLDivElement | null>(null);
  const style = pinStyle(categories, categoryId, place);
  const route = addressRoute(address ?? place.address);

  // A long press names the spot a moment later (reverse geocoding): take the
  // name then, unless it has already been typed over.
  const typed = useRef(false);
  useEffect(() => {
    if (!typed.current) setName(place.name);
  }, [place.name]);

  // Same for the kind, which can also arrive late: re-suggest the group until
  // one has been picked by hand.
  const picked = useRef(false);
  useEffect(() => {
    if (!picked.current) setCategoryId(suggestCategory(categories, place.kind));
  }, [categories, place.kind]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      // Nor does the big view of one of its photos.
      if (cardEl.current?.contains(e.target as Node) || (e.target as Element | null)?.closest?.('.group-photo-viewer')) return;
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
                style={{ '--pin': pinColorCss(s.color) } as CSSProperties}
                aria-label={category.name}
                aria-pressed={on}
                onClick={() => {
                  picked.current = true;
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

      {!picking && <PlacePhotos photos={photos} onOpen={onOpenPhoto} onGallery={onOpenGallery} />}

      <PlaceSticker place={place} />

      <div className="pin-card__main">
        {/* Just the 동 (the city when there's none): a long city name pushed it off the ticket. */}
        {route && <p className="pin-card__route">{route.to ?? route.from}</p>}
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
          style={{ '--pin': pinColorCss(style.color) } as CSSProperties}
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
          <Plus size={24} aria-hidden />
        </button>
      </div>
    </div>
  );
}
