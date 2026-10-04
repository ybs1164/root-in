import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PIN_ICON_GROUPS } from '../domain/categoryIcons';
import { useBackdropTap } from '../hooks/useBackdropTap';
import { PIN_ICONS, type PinIcon } from '../types/pin';
import PinGlyph from './PinGlyph';

interface CategoryIconPickerProps {
  selected: PinIcon;
  onSelect: (icon: PinIcon) => void;
  onClose: () => void;
}

/** A modal above the category form; selecting artwork returns directly to the form. */
export default function CategoryIconPicker({ selected, onSelect, onClose }: CategoryIconPickerProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  const [group, setGroup] = useState('all');
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const groups = PIN_ICON_GROUPS.filter((g) => group === 'all' || g.id === group);

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
      <header className="category-icon-picker__head">
        <h2 id="category-icon-picker-title">아이콘 선택</h2>
        <button type="button" className="icon-btn" aria-label="아이콘 선택 닫기" onClick={() => dialogRef.current?.close()}>
          <X size={22} aria-hidden />
        </button>
      </header>
      <nav className="category-icon-picker__tabs" aria-label="아이콘 분류">
        {[{ id: 'all', label: '전체' }, ...PIN_ICON_GROUPS].map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={group === g.id}
            onClick={() => { setGroup(g.id); if (bodyRef.current) bodyRef.current.scrollTop = 0; }}
          >
            {g.label}
          </button>
        ))}
      </nav>
      <div ref={bodyRef} className="category-icon-picker__body">
        {groups.map((g) => (
          <section key={g.id} aria-label={g.label}>
            <h3>{g.label}</h3>
            <div className="category-icon-picker__grid">
              {g.icons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className="category-icon-picker__option"
                  aria-label={PIN_ICONS[icon]}
                  aria-pressed={selected === icon}
                  onClick={() => { onSelect(icon); dialogRef.current?.close(); }}
                >
                  <span className="category-icon-picker__glyph"><PinGlyph icon={icon} /></span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </dialog>
  );
}
