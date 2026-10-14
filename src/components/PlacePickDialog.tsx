import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { categoryStyle, pinColorCss } from '../domain/pin';
import { useBackdropTap } from '../hooks/useBackdropTap';
import type { Pin, PinCategory } from '../types/pin';
import PinGlyph from './PinGlyph';

interface PlacePickDialogProps {
  /** The 후보군: your pins within 50m, nearest first. */
  places: Pin[];
  categories: PinCategory[];
  onPick: (pin: Pin) => void;
  /** Closed either way: after 선택, 취소, Esc or a tap outside. */
  onClose: () => void;
}

/**
 * 위치 선택 on TODAY when more than one of your pins is within 50m: the list
 * as a boarding pass (`ticket-dialog`), each with its category badge. Picking
 * one opens its 한 줄 메모 under it and wakes 선택. A native modal <dialog>,
 * like ConfirmDialog; mount it to ask, it opens itself.
 */
export default function PlacePickDialog({ places, categories, onPick, onClose }: PlacePickDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = places.find((p) => p.id === picked) ?? null;
  // No close() in cleanup: it would fire onClose during StrictMode's double mount.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="place-pick ticket-dialog"
      aria-labelledby="place-pick-title"
      onClose={(event) => {
        event.stopPropagation();
        onClose();
      }}
      onCancel={(event) => event.stopPropagation()}
      onPointerDown={backdrop.onPointerDown}
      onPointerUp={backdrop.onPointerUp}
      onClick={(event) => {
        event.stopPropagation();
        if (backdrop.isBackdropTap(event.target)) dialogRef.current?.close();
      }}
    >
      <div className="ticket-dialog__main">
        <h2 id="place-pick-title" className="place-pick__title">
          위치 선택
        </h2>
        <p className="place-pick__lead">
          50m안의 장소 목록을 가져왔어요.
          <br />
          추가할 장소를 선택해 주세요.
        </p>
        <ul className="place-pick__list" role="radiogroup" aria-labelledby="place-pick-title">
          {places.map((pin) => {
            const { icon, color } = categoryStyle(categories, pin.categoryId);
            const on = pin.id === picked;
            return (
              <li key={pin.id} className={`place-pick__item ${on ? 'is-picked' : ''}`}>
                <button role="radio" aria-checked={on} className="place-pick__opt" onClick={() => setPicked(pin.id)}>
                  <span
                    className={`pin-badge ${color === 0 ? 'pin-badge--none' : ''}`}
                    style={{ '--pin': pinColorCss(color) } as CSSProperties}
                    aria-hidden
                  >
                    <PinGlyph icon={icon} />
                  </span>
                  <span className="place-pick__name">{pin.place.name}</span>
                </button>
                {/* The picked place opens a little to show its 한 줄 메모 (… when it has none, as on the pin card). */}
                {on && <p className="place-pick__memo">{pin.memo || '...'}</p>}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="ticket-dialog__stub ticket-dialog__split">
        <button onClick={() => dialogRef.current?.close()}>취소</button>
        <button
          className="is-action"
          disabled={!chosen}
          onClick={() => {
            if (!chosen) return;
            onPick(chosen);
            dialogRef.current?.close();
          }}
        >
          선택
        </button>
      </div>
    </dialog>
  );
}
