import { X } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { SharedPinSet } from '../types/pin';
import PinGlyph from './PinGlyph';

interface SharedPinsViewProps {
  set: SharedPinSet;
  saved: boolean;
  onSave: () => void;
  onFocus: (index: number) => void;
  onClose: () => void;
}

const path = (set: SharedPinSet, index: number) => set.categories[index]?.name ?? '';

/** A received `#pins=` link: the pins as the sender styled them, one button to keep them all. */
export default function SharedPinsView({ set, saved, onSave, onFocus, onClose }: SharedPinsViewProps) {
  const style = (index: number) => {
    const category = set.categories[index];
    return { icon: category?.icon ?? 'pin', color: category?.color ?? 8 };
  };

  return (
    <div className="shared">
      <div className="diary-bar">
        <p className="shared__from diary-bar__title">{set.sharedBy ? `${set.sharedBy}님의 핀셋` : '공유받은 핀셋'}</p>
        <button className="icon-btn" aria-label="닫기" onClick={onClose}>
          <X size={22} aria-hidden />
        </button>
      </div>
      <h2 className="shared__title">{set.title}</h2>
      <p className="summary-line">
        {set.pins.length}곳 · {set.categories.map((c) => c.name).join(', ')}
      </p>
      <ul className="pin-list">
        {set.pins.map((pin, i) => {
          const s = style(pin.category);
          return (
            <li key={`${pin.place.id}-${i}`}>
              <button className="pin-row" onClick={() => onFocus(i)}>
                <span className="pin-badge" style={{ '--pin': `var(--pin-${s.color})` } as CSSProperties} aria-hidden>
                  <PinGlyph icon={s.icon} />
                </span>
                <span className="pin-row__text">
                  <strong>{pin.place.name}</strong>
                  <span>
                    {path(set, pin.category)}
                    {pin.memo && ` · ${pin.memo}`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="action-bar action-bar--one">
        <button className="btn btn--primary" onClick={onSave} disabled={saved}>
          {saved ? '저장됨 ✓' : `내 핀에 모두 저장 (${set.pins.length})`}
        </button>
      </div>
    </div>
  );
}
