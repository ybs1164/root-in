import { Trash2, X } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { categoryPath, categoryStyle, PIN_LIMITS } from '../domain/pin';
import { kakaoPlaceUrl } from '../lib/directionsLink';
import type { Pin, PinCategory } from '../types/pin';
import CategoryChips from './CategoryChips';

interface PinCardProps {
  pin: Pin;
  categories: PinCategory[];
  addLabel: string;
  addDisabled: boolean;
  onAdd: () => void;
  onRecategorize: (categoryId: string) => void;
  onMemo: (memo: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** What tapping a pin (on the map or in the list) opens. */
export default function PinCard({ pin, categories, addLabel, addDisabled, onAdd, onRecategorize, onMemo, onDelete, onClose }: PinCardProps) {
  const [picking, setPicking] = useState(false);
  const style = categoryStyle(categories, pin.categoryId);

  return (
    <div className="place-card" role="dialog" aria-label={pin.place.name}>
      <div className="place-card__info">
        <strong>{pin.place.name}</strong>
        <button
          className="cat-link"
          style={{ '--pin': `var(--pin-${style.color})` } as CSSProperties}
          aria-expanded={picking}
          onClick={() => setPicking((v) => !v)}
        >
          {style.emoji} {categoryPath(categories, pin.categoryId)} · 변경
        </button>
      </div>
      {picking ? (
        <CategoryChips
          categories={categories}
          selected={pin.categoryId}
          label="카테고리 변경"
          onPick={(id) => {
            onRecategorize(id);
            setPicking(false);
          }}
        />
      ) : (
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
      )}
      <div className="place-card__actions">
        <button className="icon-btn icon-btn--danger" aria-label="핀 삭제" onClick={onDelete}>
          <Trash2 size={20} aria-hidden />
        </button>
        <a className="btn btn--ghost" href={kakaoPlaceUrl(pin.place)} target="_blank" rel="noreferrer">
          상세
        </a>
        <button className="btn btn--primary" onClick={onAdd} disabled={addDisabled}>
          {addLabel}
        </button>
      </div>
      <button className="place-card__close icon-btn" aria-label="닫기" onClick={onClose}>
        <X size={20} aria-hidden />
      </button>
    </div>
  );
}
