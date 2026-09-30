import { Download, Link, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { downloadDataUrl, renderDayImage, type DayImageInput } from '../lib/dayImage';

interface DayShareSheetProps extends DayImageInput {
  date: string;
  onClose: () => void;
}

/**
 * 📅 → 공유: the day's pings and lines as an image, in a centred popup
 * styled like a macOS window. One row of round buttons: 링크 복사 (which link
 * is still to be decided), 이미지 저장, and SNS 공유 (not wired yet). The two
 * unfinished ones are disabled for now.
 */
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
      className="mac-window day-share"
      aria-labelledby="day-share-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {/* macOS-style title bar with just the red close light. */}
      <div className="mac-window__bar">
        <div className="mac-window__lights">
          <button className="mac-window__light mac-window__light--close" aria-label="닫기" onClick={onClose} />
        </div>
        <h2 id="day-share-title" className="mac-window__title">
          {image.title} 공유
        </h2>
      </div>

      <div className="mac-window__body">
        <div className="day-share__preview">
          {src ? <img src={src} alt={`${image.title}에 다녀온 곳을 잇는 그림`} /> : <span className="hint">이미지 만드는 중…</span>}
        </div>

        <div className="day-share__actions" role="group" aria-label="공유">
          {/* TODO: decide what 링크 복사 copies, then wire it up. */}
          <button className="day-share__action" disabled>
            <span className="day-share__action-dot" aria-hidden>
              <Link size={20} />
            </span>
            링크 복사
          </button>
          <button
            className="day-share__action"
            disabled={!src}
            onClick={() => src && downloadDataUrl(src, `root-in-${date}.png`)}
          >
            <span className="day-share__action-dot day-share__action-dot--primary" aria-hidden>
              <Download size={20} />
            </span>
            이미지 저장
          </button>
          {/* TODO: one button for every SNS (likely the system share sheet); not wired yet. */}
          <button className="day-share__action" disabled>
            <span className="day-share__action-dot" aria-hidden>
              <Share2 size={20} />
            </span>
            SNS 공유
          </button>
        </div>
      </div>
    </dialog>
  );
}
