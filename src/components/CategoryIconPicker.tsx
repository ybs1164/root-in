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

/**
 * The full icon library, above the category form and dressed as the same
 * boarding pass (`ticket-dialog`): title, group tabs and the scrolling grid
 * on the ticket, then the tear line and a 취소 stub. Picking an icon returns
 * straight to the form.
 */
export default function CategoryIconPicker({ selected, onSelect, onClose }: CategoryIconPickerProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  const [group, setGroup] = useState('all');
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const scrollToGroup = (id: string) => {
    setGroup(id);
    const body = bodyRef.current;
    if (!body) return;
    const heading = body.querySelector<HTMLElement>(`[data-icon-group="${id}"] h3`);
    const top = heading ? body.scrollTop + heading.getBoundingClientRect().top - body.getBoundingClientRect().top : 0;
    // The scroll container naturally clamps lower sections to its bottom.
    body.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="category-icon-picker ticket-dialog"
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
      <div className="ticket-dialog__main category-icon-picker__main">
        <h2 id="category-icon-picker-title" className="category-icon-picker__title">
          아이콘 선택
        </h2>
        <nav className="category-icon-picker__tabs" aria-label="아이콘 분류">
          {[{ id: 'all', label: '전체' }, ...PIN_ICON_GROUPS].map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={group === g.id}
              onClick={() => scrollToGroup(g.id)}
            >
              {g.label}
            </button>
          ))}
        </nav>
        <div ref={bodyRef} className="category-icon-picker__body">
          {PIN_ICON_GROUPS.map((g) => (
            <section key={g.id} data-icon-group={g.id} aria-label={g.label}>
              <h3>{g.label}</h3>
              <div className="icon-grid category-icon-picker__grid">
                {g.icons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={`icon-grid__btn ${selected === icon ? 'is-on' : ''}`}
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
      </div>
      <div className="ticket-dialog__stub ticket-dialog__split">
        <button type="button" onClick={() => dialogRef.current?.close()}>
          취소
        </button>
      </div>
    </dialog>
  );
}
