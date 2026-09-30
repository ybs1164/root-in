import { Download, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { downloadDataUrl, renderDayImage, type DayImageInput } from '../lib/dayImage';

interface DayShareSheetProps extends DayImageInput {
  date: string;
  onClose: () => void;
}

// Shown, not wired yet: sending to each service comes later.
const SNS_TARGETS = ['카카오톡', '인스타그램', 'X', '페이스북'];

/** 📅 → 공유: the day's pings and lines as an image, to save (SNS buttons are placeholders). */
export default function DayShareSheet({ date, onClose, ...image }: DayShareSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    let alive = true;
    renderDayImage(image).then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
    // Rendered once per opening: the sheet is modal, so the day can't change underneath.
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="share-sheet day-share"
      aria-labelledby="day-share-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="share-sheet__body">
        <div className="sheet-grip" aria-hidden />
        <div className="share-sheet__head">
          <h2 id="day-share-title">{image.title} 공유</h2>
          <button className="icon-btn" aria-label="닫기" onClick={onClose}>
            <X size={22} aria-hidden />
          </button>
        </div>

        <div className="day-share__preview">
          {src ? <img src={src} alt={`${image.title}에 다녀온 곳을 잇는 그림`} /> : <span className="hint">이미지 만드는 중…</span>}
        </div>

        <button
          className="btn btn--primary btn--block"
          disabled={!src}
          onClick={() => src && downloadDataUrl(src, `root-in-${date}.png`)}
        >
          <Download size={18} aria-hidden />
          이미지 저장
        </button>

        <div className="day-share__sns" role="group" aria-label="SNS로 공유 (준비 중)">
          {SNS_TARGETS.map((name) => (
            <button key={name} className="day-share__sns-btn" disabled title="준비 중">
              <span className="day-share__sns-dot" aria-hidden>
                {name.slice(0, 1)}
              </span>
              {name}
            </button>
          ))}
        </div>
        <p className="hint hint--muted">SNS 공유는 준비 중이에요.</p>
      </div>
    </dialog>
  );
}
