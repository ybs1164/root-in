import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { categoryPath, categoryStyle, PIN_LIMITS } from '../domain/pin';
import { kakaoPlaceUrl } from '../lib/directionsLink';
import type { Pin, PinCategory } from '../types/pin';
import CategoryChips from './CategoryChips';

interface PinCardProps {
  pin: Pin;
  categories: PinCategory[];
  onRecategorize: (categoryId: string) => void;
  onRename: (name: string) => void;
  onMemo: (memo: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * What tapping a pin opens: a card standing just above the pin, which the map
 * has centred. Top row: the pin's icon (tap → pick another category, which is
 * what sets the icon), its name, and a pen to rename it. Bottom row: ⋯ for the
 * details, and the bin at the right, which deletes at once (the toast can undo).
 * A touch outside the card closes it.
 */
export default function PinCard({ pin, categories, onRecategorize, onRename, onMemo, onDelete, onClose }: PinCardProps) {
  const [picking, setPicking] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [details, setDetails] = useState(false);
  const style = categoryStyle(categories, pin.categoryId);
  const cardEl = useRef<HTMLDivElement | null>(null);

  // Another pin: start from the plain card again.
  useEffect(() => {
    setPicking(false);
    setRenaming(false);
    setDetails(false);
  }, [pin.id]);

  // A touch anywhere else (the map, another control) closes the card; a pin
  // marker is left alone, since tapping one opens its own card.
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (cardEl.current?.contains(t) || t?.closest('.map-marker--pin')) return;
      onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);

  const commitName = (value: string) => {
    const name = value.trim().slice(0, PIN_LIMITS.name);
    if (name && name !== pin.place.name) onRename(name);
    setRenaming(false);
  };

  return (
    <div ref={cardEl} className="place-card place-card--pin pin-card" role="dialog" aria-label={pin.place.name}>
      <div className="pin-card__top">
        <button
          className="pin-card__icon"
          style={{ '--pin': `var(--pin-${style.color})` } as CSSProperties}
          aria-label={`아이콘 바꾸기 (지금 ${categoryPath(categories, pin.categoryId)})`}
          aria-expanded={picking}
          onClick={() => setPicking((v) => !v)}
        >
          <span aria-hidden>{style.emoji}</span>
        </button>
        {renaming ? (
          <input
            className="pin-card__name-input"
            aria-label="위치 이름"
            defaultValue={pin.place.name}
            maxLength={PIN_LIMITS.name}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => commitName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setRenaming(false);
            }}
          />
        ) : (
          <strong className="pin-card__name">{pin.place.name}</strong>
        )}
        <button className="icon-btn pin-card__tool" aria-label="이름 바꾸기" aria-pressed={renaming} onClick={() => setRenaming((v) => !v)}>
          <Pencil size={20} aria-hidden />
        </button>
      </div>

      {picking && (
        <CategoryChips
          categories={categories}
          selected={pin.categoryId}
          label="아이콘(카테고리) 바꾸기"
          onPick={(id) => {
            onRecategorize(id);
            setPicking(false);
          }}
        />
      )}

      {details && (
        <dl className="pin-card__details">
          <dt>카테고리</dt>
          <dd>{categoryPath(categories, pin.categoryId)}</dd>
          {pin.place.address && (
            <>
              <dt>주소</dt>
              <dd>{pin.place.address}</dd>
            </>
          )}
          <dt>메모</dt>
          <dd>
            <input
              className="place-card__memo"
              // Keyed by pin so switching pins resets the uncontrolled field.
              key={pin.id}
              defaultValue={pin.memo ?? ''}
              maxLength={PIN_LIMITS.memo}
              placeholder="한 줄 메모"
              onBlur={(e) => {
                if (e.target.value.trim() !== (pin.memo ?? '')) onMemo(e.target.value.trim());
              }}
            />
          </dd>
          <dd className="pin-card__link">
            <a href={kakaoPlaceUrl(pin.place)} target="_blank" rel="noreferrer">
              카카오맵에서 보기
            </a>
          </dd>
        </dl>
      )}

      <div className="pin-card__bottom">
        <button className="icon-btn pin-card__tool" aria-label="상세 정보" aria-expanded={details} onClick={() => setDetails((v) => !v)}>
          <Ellipsis size={22} aria-hidden />
        </button>
        <button className="icon-btn icon-btn--danger" aria-label="핀 삭제" onClick={onDelete}>
          <Trash2 size={20} aria-hidden />
        </button>
      </div>
    </div>
  );
}
