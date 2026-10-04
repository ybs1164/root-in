import { Check, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { addressRoute } from '../domain/addressRoute';
import { categoriesWithUncategorized, categoryStyle, findCategory, PIN_LIMITS } from '../domain/pin';
import type { Pin, PinCategory } from '../types/pin';
import PinGlyph from './PinGlyph';

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
 * What tapping a pin opens: a boarding-pass ticket standing just above the
 * pin, which the map has centred. Left: the place's city → neighbourhood in
 * English (from its address, read-only), its name, its one-line memo, and a
 * pen. Right, past the tear line: GROUP, the category's icon and the bin.
 * The pen opens the name, memo and category for editing; tapped again (or
 * Enter) it saves them. A touch outside the card saves any edit and closes it.
 */
export default function PinCard({ pin, categories, onRecategorize, onRename, onMemo, onDelete, onClose }: PinCardProps) {
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const style = categoryStyle(categories, pin.categoryId);
  const route = addressRoute(pin.place.address);
  const cardEl = useRef<HTMLDivElement | null>(null);
  const nameEl = useRef<HTMLInputElement | null>(null);
  const memoEl = useRef<HTMLInputElement | null>(null);

  // Another pin: start from the plain ticket again.
  useEffect(() => {
    setEditing(false);
    setPicking(false);
  }, [pin.id]);

  const save = () => {
    const name = nameEl.current?.value.trim().slice(0, PIN_LIMITS.name);
    if (name && name !== pin.place.name) onRename(name);
    const memo = memoEl.current?.value.trim().slice(0, PIN_LIMITS.memo);
    if (memo !== undefined && memo !== (pin.memo ?? '')) onMemo(memo);
  };

  const finish = () => {
    save();
    setEditing(false);
    setPicking(false);
  };

  // A touch anywhere else (the map, another control) closes the card, keeping
  // an edit in progress; a pin marker is left alone, since tapping one opens
  // its own card.
  const saveRef = useRef(save);
  saveRef.current = editing ? save : () => {};
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (cardEl.current?.contains(t) || t?.closest('.map-marker--pin')) return;
      saveRef.current();
      onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);

  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') finish();
    if (e.key === 'Escape') {
      setEditing(false);
      setPicking(false);
    }
  };

  return (
    <div
      ref={cardEl}
      className={`place-card place-card--pin pin-card ${editing ? 'is-editing' : ''}`}
      role="dialog"
      aria-label={pin.place.name}
    >
      {picking && (
        <div className="folder-picker pin-card__icons" role="dialog" aria-label="카테고리 바꾸기">
          {categoriesWithUncategorized(categories).map((category) => {
            const s = categoryStyle(categories, category.id);
            const on = category.id === pin.categoryId;
            return (
              <button
                key={category.id}
                className={`folder-picker__opt pin-card__icon-opt ${on ? 'is-on' : ''}`}
                style={{ '--pin': `var(--pin-${s.color})` } as CSSProperties}
                aria-label={category.name}
                aria-pressed={on}
                onClick={() => {
                  onRecategorize(category.id);
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
        {editing ? (
          <>
            <input
              // Keyed by pin so switching pins resets the uncontrolled fields.
              key={`name-${pin.id}`}
              ref={nameEl}
              className="pin-card__name-input"
              aria-label="장소 이름"
              defaultValue={pin.place.name}
              maxLength={PIN_LIMITS.name}
              autoFocus
              // Caret at the end, nothing selected: the text looks just as it did.
              onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
              onKeyDown={keys}
            />
            <input
              key={`memo-${pin.id}`}
              ref={memoEl}
              className="pin-card__memo-input"
              aria-label="한 줄 메모"
              placeholder="..."
              defaultValue={pin.memo ?? ''}
              maxLength={PIN_LIMITS.memo}
              onKeyDown={keys}
            />
          </>
        ) : (
          <>
            <strong className="pin-card__name">{pin.place.name}</strong>
            <p className={`pin-card__memo ${pin.memo ? '' : 'is-empty'}`}>{pin.memo || '...'}</p>
          </>
        )}
        <button
          className="icon-btn pin-card__pen"
          aria-label={editing ? '수정 완료' : '수정'}
          aria-pressed={editing}
          onClick={() => (editing ? finish() : setEditing(true))}
        >
          {editing ? <Check size={20} aria-hidden /> : <Pencil size={18} aria-hidden />}
        </button>
      </div>

      <div className="pin-card__stub">
        <span className="pin-card__group">GROUP</span>
        {editing ? (
          <button
            className="pin-card__category is-editable"
            style={{ '--pin': `var(--pin-${style.color})` } as CSSProperties}
            aria-label={`카테고리 바꾸기 (지금 ${findCategory(categories, pin.categoryId).name})`}
            aria-expanded={picking}
            onClick={() => setPicking((v) => !v)}
          >
            <PinGlyph icon={style.icon} />
          </button>
        ) : (
          <span
            className="pin-card__category"
            style={{ '--pin': `var(--pin-${style.color})` } as CSSProperties}
            role="img"
            aria-label={findCategory(categories, pin.categoryId).name}
          >
            <PinGlyph icon={style.icon} />
          </span>
        )}
        <button className="icon-btn pin-card__bin" aria-label="핀 삭제" onClick={onDelete}>
          <Trash2 size={20} aria-hidden />
        </button>
      </div>
    </div>
  );
}
