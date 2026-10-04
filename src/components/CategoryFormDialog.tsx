import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { PIN_LIMITS } from '../domain/pin';
import { QUICK_PIN_ICONS } from '../domain/categoryIcons';
import { PIN_COLORS, PIN_ICONS, type PinColor, type PinIcon } from '../types/pin';
import PinGlyph from './PinGlyph';
import { useBackdropTap } from '../hooks/useBackdropTap';
import CategoryIconPicker from './CategoryIconPicker';

export interface CategoryFormValue {
  name: string;
  icon: PinIcon;
  color: PinColor;
}

interface CategoryFormDialogProps {
  mode: 'create' | 'edit';
  initial: CategoryFormValue;
  /** Returns a message when it can't be saved (the dialog then stays open). */
  onSubmit: (value: CategoryFormValue) => string | null;
  /** Closed either way: after 생성/완료, 취소, Esc or a tap outside. */
  onClose: () => void;
}

/**
 * 핀 카테고리 생성 / 편집, a boarding pass like the other centre popups
 * (`ticket-dialog`): the icon in the middle with five shortcuts and a library
 * button under it, the
 * palette, the name, then the stub torn in two — 취소 | 생성 (완료).
 * A native modal <dialog>, so it sits above the category sheet.
 */
export default function CategoryFormDialog({ mode, initial, onSubmit, onClose }: CategoryFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const backdrop = useBackdropTap(dialogRef);
  const [value, setValue] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [extraIcon, setExtraIcon] = useState<PinIcon | null>(QUICK_PIN_ICONS.includes(initial.icon) ? null : initial.icon);
  // No close() in cleanup: it would fire onClose during StrictMode's check (as ConfirmDialog).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const title = mode === 'create' ? '새 카테고리' : '카테고리 편집';
  const canSubmit = value.name.trim().length > 0;
  const submit = () => {
    if (!canSubmit) return;
    const result = onSubmit({ ...value, name: value.name.trim() });
    if (result) setProblem(result);
    else dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      className="cat-form ticket-dialog"
      aria-labelledby="cat-form-title"
      // React passes a dialog's close / cancel up its component tree: stop
      // them here, or closing this would close the category sheet under it.
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
      <form
        className="cat-form__form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="ticket-dialog__main cat-form__main">
          <h2 id="cat-form-title" className="cat-form__title">
            {title}
          </h2>
          {/* The chosen icon, large, in the chosen colour; the icon list stays open under it. */}
          <span
            className="pin-badge cat-form__icon"
            style={{ '--pin': `var(--pin-${value.color})` } as CSSProperties}
            role="img"
            aria-label={`아이콘: ${PIN_ICONS[value.icon]}`}
          >
            <PinGlyph icon={value.icon} />
          </span>
          <div className="icon-grid cat-form__icons" role="group" aria-label="아이콘">
            {QUICK_PIN_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`icon-grid__btn ${value.icon === icon ? 'is-on' : ''}`}
                aria-pressed={value.icon === icon}
                aria-label={PIN_ICONS[icon]}
                onClick={() => setValue((v) => ({ ...v, icon }))}
              >
                <PinGlyph icon={icon} />
              </button>
            ))}
            <button
              type="button"
              className={`icon-grid__btn ${extraIcon && value.icon === extraIcon ? 'is-on' : ''}`}
              aria-label={extraIcon ? `더 많은 아이콘: ${PIN_ICONS[extraIcon]}` : '더 많은 아이콘'}
              aria-pressed={!!extraIcon && value.icon === extraIcon}
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen(true)}
            >
              {extraIcon ? <PinGlyph icon={extraIcon} /> : <MoreHorizontal size={22} aria-hidden />}
            </button>
          </div>
          <div className="cat-form__colors" role="group" aria-label="색">
            {PIN_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`color-dot ${value.color === color ? 'is-on' : ''}`}
                style={{ '--pin': `var(--pin-${color})` } as CSSProperties}
                aria-pressed={value.color === color}
                aria-label={`색 ${color}`}
                onClick={() => setValue((v) => ({ ...v, color }))}
              />
            ))}
          </div>
          <input
            className="cat-form__name"
            value={value.name}
            maxLength={PIN_LIMITS.categoryName}
            placeholder="카테고리 이름"
            aria-label="카테고리 이름"
            onChange={(event) => {
              setProblem(null);
              setValue((v) => ({ ...v, name: event.target.value }));
            }}
          />
          {problem && <p className="cat-form__problem">{problem}</p>}
        </div>
        <div className="ticket-dialog__stub ticket-dialog__split">
          <button type="button" onClick={() => dialogRef.current?.close()}>
            취소
          </button>
          <button type="submit" className="is-action" disabled={!canSubmit}>
            {mode === 'create' ? '생성' : '완료'}
          </button>
        </div>
      </form>
      {pickerOpen && (
        <CategoryIconPicker
          selected={value.icon}
          onSelect={(icon) => { setExtraIcon(icon); setValue((v) => ({ ...v, icon })); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </dialog>
  );
}
