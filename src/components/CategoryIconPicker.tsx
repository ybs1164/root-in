import { useEffect, useRef } from 'react';
import { PIN_ICON_GROUPS } from '../domain/categoryIcons';
import { useBackdropTap } from '../hooks/useBackdropTap';
import { PIN_ICONS, type PinIcon } from '../types/pin';
import PinGlyph from './PinGlyph';

interface CategoryIconPickerProps {
  selected: PinIcon;
  onSelect: (icon: PinIcon) => void;
  onClose: () => void;
}

/**
 * The full icon library, above the category form: a rounded white card with
 * a spaced-caps ICON label and an accent dash, then each group under the same
 * kind of label in its own outlined panel. Picking an icon returns straight
 * to the form; a tap outside (or Esc) closes it.
 */
export default function CategoryIconPicker({ selected, onSelect, onClose }: CategoryIconPickerProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);

  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="category-icon-picker"
      aria-labelledby="category-icon-picker-title"
      onClose={(event) => { event.stopPropagation(); onClose(); }}
      onCancel={(event) => event.stopPropagation()}
      onPointerDown={backdrop.onPointerDown}
      onPointerUp={backdrop.onPointerUp}
      onClick={(event) => {
        event.stopPropagation();
        if (backdrop.isBackdropTap(event.target)) dialogRef.current?.close();
      }}
    >
      <h2 id="category-icon-picker-title" className="label-dash category-icon-picker__title">
        <span aria-hidden>ICON</span>
        <span className="sr-only">아이콘 선택</span>
      </h2>
      <div className="category-icon-picker__body">
        {PIN_ICON_GROUPS.map((g) => (
          <section key={g.id} className="category-icon-picker__group" aria-label={g.label}>
            <h3 className="label-dash" aria-hidden>
              {g.en}
            </h3>
            <div className="category-icon-picker__grid">
              {g.icons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`category-icon-picker__option ${selected === icon ? 'is-on' : ''}`}
                  aria-label={PIN_ICONS[icon]}
                  aria-pressed={selected === icon}
                  onClick={() => { onSelect(icon); dialogRef.current?.close(); }}
                >
                  <PinGlyph icon={icon} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </dialog>
  );
}
