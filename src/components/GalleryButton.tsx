import { Images } from 'lucide-react';

/** The gallery's button (TODAY's row, a group's map), the camera's twin. */
export default function GalleryButton({ className = '', onOpen }: { className?: string; onOpen(): void }) {
  return (
    <button type="button" className={`camera-btn ${className}`} aria-label="갤러리" onClick={onOpen}>
      <Images size={24} strokeWidth={2.2} aria-hidden />
    </button>
  );
}
