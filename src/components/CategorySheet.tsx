import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import CategoryManager from './CategoryManager';

type CategorySheetProps = Parameters<typeof CategoryManager>[0] & {
  onClose: () => void;
};

/** The pin map's bottom-right + → 핀 카테고리, rising from the bottom (moved out of 설정). */
export default function CategorySheet({ onClose, ...categoryProps }: CategorySheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="share-sheet category-sheet"
      aria-labelledby="category-sheet-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="share-sheet__body">
        <div className="sheet-grip" aria-hidden />
        <div className="share-sheet__head">
          <h2 id="category-sheet-title">핀 카테고리</h2>
          <button className="icon-btn" aria-label="닫기" onClick={onClose}>
            <X size={22} aria-hidden />
          </button>
        </div>
        <CategoryManager {...categoryProps} />
      </div>
    </dialog>
  );
}
