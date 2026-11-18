import { ChevronLeft } from 'lucide-react';
import { useEffect } from 'react';
import EmptyMark from './EmptyMark';

/**
 * The sticker shop, opened from the store button at the front of the sticker
 * tool's row of themes. Nothing is on sale yet: for now it only says so.
 * An open dialog, so the phone's back button closes it like any other.
 */
export default function StickerShop({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  return (
    <dialog
      open
      className="sticker-shop"
      aria-label="스티커 상점"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="sticker-shop__head">
        <button className="sticker-shop__back" aria-label="스티커로 돌아가기" onClick={onClose}>
          <ChevronLeft size={26} strokeWidth={2.2} aria-hidden />
        </button>
        <h2>STICKER SHOP</h2>
      </header>
      <div className="empty-day sticker-shop__empty">
        <EmptyMark label="" />
        <p className="empty-day__text">스티커 상점은 준비 중이에요.</p>
      </div>
    </dialog>
  );
}
